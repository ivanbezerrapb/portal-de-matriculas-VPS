import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setLeadCheckIn } from "@/lib/ext/cadastros.functions";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  startOfDay, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Maximize, MessageCircle, Minimize } from "lucide-react";
import { listCalendarEvents, markEnrollmentDone, markVisitNoShow, type CalendarEvent } from "@/lib/ext/calendario.functions";
import { Button, Card, Input, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário · Portal de Matrículas" },
      { name: "description", content: "Agenda de visitas dos LEADS por unidade, com check-in." },
      { property: "og:title", content: "Calendário · Portal de Matrículas" },
      { property: "og:description", content: "Agenda de visitas dos LEADS por unidade, com check-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

type View = "month" | "week" | "day";
type Status = CalendarEvent["status"];
const STATUS_LABEL: Record<Status, string> = { scheduled: "Agendada", done: "Realizada", missed: "Não realizada" };
type Kind = CalendarEvent["kind"];
const KIND_LABEL: Record<Kind, string> = { visita: "Visita", matricula: "Matrícula" };
const STATUS_CLASS: Record<Status, string> = {
  scheduled: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-100",
  done: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100",
  missed: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100",
};

function whatsapp(phone: string | null) {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 10 ? `https://wa.me/55${d}` : null;
}

function CalendarPage() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Status[]>(["scheduled", "done", "missed"]);
  const [kinds, setKinds] = useState<Kind[]>(["visita", "matricula"]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current && !!rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen().catch(() => toast.error("Não foi possível abrir em tela cheia."));
  };
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridH, setGridH] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || !isFullscreen) return;
    const ro = new ResizeObserver(() => setGridH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const checkInM = useMutation({
    mutationFn: (id: string) => setLeadCheckIn({ data: { id } }),
    onSuccess: () => {
      toast.success("Check-in confirmado. O cartão foi dado como ganho.");
      setConfirming(false);
      setSelected(null);
      for (const k of ["calendar", "pipeline", "submissions", "crm-tasks"]) queryClient.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [noShow, setNoShow] = useState(false);
  const noShowM = useMutation({
    mutationFn: (id: string) => markVisitNoShow({ data: { opportunity_id: id } }),
    onSuccess: () => {
      toast.success("Falta registrada. O cartão foi para a etapa de reagendamento.");
      setNoShow(false);
      setSelected(null);
      for (const k of ["calendar", "pipeline", "crm-notes", "notes"]) queryClient.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [enrolling, setEnrolling] = useState(false);
  const [enrollCount, setEnrollCount] = useState("1");
  const enrollM = useMutation({
    mutationFn: (id: string) => markEnrollmentDone({ data: { opportunity_id: id, count: Number(enrollCount) } }),
    onSuccess: () => {
      toast.success("Matrícula confirmada. O cartão foi dado como ganho.");
      setEnrolling(false);
      setSelected(null);
      for (const k of ["calendar", "pipeline", "submissions", "crm-tasks", "crm-notes", "notes"]) queryClient.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const range = useMemo(() => {
    if (view === "month")
      return { from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }), to: addDays(endOfWeek(endOfMonth(cursor)), 1) };
    if (view === "week") return { from: startOfWeek(cursor), to: addDays(endOfWeek(cursor), 1) };
    return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
  }, [view, cursor]);

  const q = useQuery({
    queryKey: ["calendar", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => listCalendarEvents({ data: { from: range.from.toISOString(), to: range.to.toISOString() } }),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const events = (q.data?.events ?? []).filter(
    (e) => statuses.includes(e.status) && kinds.includes(e.kind ?? "visita") && (!schoolFilter || e.school_id === schoolFilter),
  );
  const eventsOn = (day: Date) => events.filter((e) => isSameDay(new Date(e.at), day));

  const move = (dir: 1 | -1) =>
    setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addDays(c, dir)));
  const title =
    view === "month"
      ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
      : view === "week"
        ? `${format(range.from, "dd/MM")} – ${format(addDays(range.to, -1), "dd/MM/yyyy")}`
        : format(cursor, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const chip = (e: CalendarEvent, full = false) => (
    <button
      key={e.id}
      onClick={() => setSelected(e)}
      className={`w-full rounded border px-1.5 py-0.5 text-left text-[11px] leading-tight ${STATUS_CLASS[e.status]}`}
    >
      <span className="block font-semibold">{format(new Date(e.at), "HH:mm")} - {KIND_LABEL[e.kind ?? "visita"]}</span>
      <span className={full ? "block break-words" : "line-clamp-2 break-words"}>{e.title}</span>
      {full && <span className="block opacity-80">{STATUS_LABEL[e.status]} · {e.school_name}</span>}
    </button>
  );

  const days: Date[] = [];
  for (let d = range.from; d < range.to; d = addDays(d, 1)) days.push(d);
  const weeks = Math.max(1, Math.ceil(days.length / 7));
  const cellH = gridH > 0 ? (gridH - 26) / weeks : 0;
  // 28px número do dia + 18px "+N mais"; cada item ~40px (2 linhas + espaço).
  const maxPerDay = Math.max(1, Math.floor((cellH - 46) / 40));

  return (
    <div
      ref={rootRef}
      className={isFullscreen ? "flex h-screen flex-col gap-2 overflow-hidden bg-background p-3" : "space-y-4 p-4 md:p-6"}
    >
      <div>
        <p className="text-sm font-medium text-primary">Agenda</p>
        <h1 className="font-display text-3xl font-bold text-foreground">Calendário</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setCursor(new Date())}>Hoje</Button>
        <Button variant="ghost" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" onClick={() => move(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
        <h2 className="mr-auto font-display text-lg font-semibold capitalize text-foreground">{title}</h2>
        {q.isFetching && <Spinner />}
        <div className="flex rounded-lg border border-border p-0.5">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-sm ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize className="mr-1 h-4 w-4" /> : <Maximize className="mr-1 h-4 w-4" />}
          {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Unidade:</span>
          {(q.data?.schools ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => setSchoolFilter((cur) => (cur === s.id ? null : s.id))}
              className={`rounded-full border px-3 py-1 ${schoolFilter === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Tipo:</span>
          {(["visita", "matricula"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKinds((l) => toggle(l, k))}
              className={`rounded-full border px-3 py-1 ${kinds.includes(k) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Situação:</span>
          {(["scheduled", "done", "missed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setStatuses((l) => toggle(l, t))}
              className={`rounded-full border px-3 py-1 ${statuses.includes(t) ? STATUS_CLASS[t] : "border-border text-muted-foreground"}`}
            >
              {STATUS_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <Card className={`overflow-hidden p-0 ${isFullscreen ? "min-h-0 flex-1" : ""}`}>
        {view === "day" ? (
          <div className={`space-y-2 p-4 ${isFullscreen ? "h-full overflow-auto" : ""}`}>
            {eventsOn(cursor).length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>}
            {eventsOn(cursor).map((e) => chip(e, true))}
          </div>
        ) : (
          <div
            ref={gridRef}
            className={`grid grid-cols-7 ${isFullscreen ? "h-full" : ""}`}
            style={isFullscreen ? { gridTemplateRows: `auto repeat(${weeks}, minmax(0, 1fr))` } : undefined}
          >
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="border-b border-border bg-muted/40 px-2 py-1 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
            {days.map((d) => {
              const list = eventsOn(d);
              const today = isSameDay(d, new Date());
              const limit = isFullscreen ? maxPerDay : view === "month" ? 3 : Infinity;
              return (
                <div
                  key={d.toISOString()}
                  className={`border-b border-r border-border p-1 ${isFullscreen ? "min-h-0 overflow-hidden" : view === "week" ? "min-h-64" : "min-h-28"} ${view === "month" && !isSameMonth(d, cursor) ? "bg-muted/30" : ""}`}
                >
                  <button
                    onClick={() => { setCursor(d); setView("day"); }}
                    className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${today ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                  >
                    {format(d, "d")}
                  </button>
                  <div className="space-y-1">
                    {list.slice(0, limit).map((e) => chip(e, view === "week" && !isFullscreen))}
                    {list.length > limit && (
                      <button onClick={() => { setCursor(d); setView("day"); }} className="text-[11px] text-primary">
                        +{list.length - limit} mais
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => { setSelected(null); setConfirming(false); }}>
          <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASS[selected.status]}`}>Visita · {STATUS_LABEL[selected.status]}</span>
            <h3 className="mt-2 break-words font-display text-lg font-semibold text-foreground">{selected.title}</h3>
            <dl className="mt-3 space-y-1 text-sm">
              <div><dt className="inline text-muted-foreground">Quando: </dt><dd className="inline">{format(new Date(selected.at), "dd/MM/yyyy 'às' HH:mm")}</dd></div>
              <div><dt className="inline text-muted-foreground">Unidade: </dt><dd className="inline">{selected.school_name}</dd></div>
              <div><dt className="inline text-muted-foreground">Série: </dt><dd className="inline">{(selected.series ?? []).length ? (selected.series ?? []).join(", ") : "—"}</dd></div>
              {selected.checked_in_at && (
                <div className="font-medium text-emerald-700">
                  Realizada em {format(new Date(selected.checked_in_at), "dd/MM 'às' HH:mm")}
                </div>
              )}
              {selected.phone && (
                <div className="flex items-center gap-2">
                  <dt className="text-muted-foreground">Telefone:</dt><dd>{selected.phone}</dd>
                  {whatsapp(selected.phone) && (
                    <a href={whatsapp(selected.phone)!} target="_blank" rel="noreferrer" className="text-emerald-600" aria-label="WhatsApp">
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </dl>
            {confirming && (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold text-foreground">Confirmar check-in?</p>
                <p className="mt-1 text-muted-foreground">
                  A visita será registrada como realizada hoje, o cartão será dado como ganho e as tarefas pendentes serão concluídas. Esta ação é definitiva.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
                  <Button disabled={checkInM.isPending} onClick={() => checkInM.mutate(selected.submission_id)}>
                    Confirmar check-in
                  </Button>
                </div>
              </div>
            )}
            {noShow && (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold text-foreground">Confirmar que o cliente faltou?</p>
                <p className="mt-1 text-muted-foreground">
                  A falta à {selected.kind === "matricula" ? "matrícula" : "visita"} de {format(new Date(selected.at), "dd/MM/yyyy 'às' HH:mm")} ficará no histórico do cartão, a data será apagada e o cartão irá para {selected.kind === "matricula" ? "Reagendar Matrícula" : "Reagendar visita"}.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setNoShow(false)}>Cancelar</Button>
                  <Button variant="danger" disabled={noShowM.isPending} onClick={() => noShowM.mutate(selected.id)}>
                    Sim, faltou
                  </Button>
                </div>
              </div>
            )}
            {enrolling && (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold text-foreground">Confirmar matrícula?</p>
                <p className="mt-1 text-muted-foreground">
                  O cartão será dado como ganho, irá para Matriculado e as tarefas pendentes serão concluídas.
                </p>
                <label className="mt-3 block text-xs font-medium text-muted-foreground">Quantidade de matrículas efetivadas</label>
                <Input type="number" min={1} step={1} value={enrollCount} onChange={(e) => setEnrollCount(e.target.value)} className="mt-1 max-w-32" />
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEnrolling(false)}>Cancelar</Button>
                  <Button
                    disabled={enrollM.isPending || !Number.isInteger(Number(enrollCount)) || Number(enrollCount) < 1}
                    onClick={() => enrollM.mutate(selected.id)}
                  >
                    Confirmar matrícula
                  </Button>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {selected.funnel_id && (
                <Link to="/crm/pipeline" search={{ funil: selected.funnel_id } as never} className="text-sm font-medium text-primary hover:underline self-center">
                  Abrir no Pipeline
                </Link>
              )}
              {selected.can_check_in && selected.kind === "visita" && !confirming && !noShow && (
                <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => setConfirming(true)}>Compareceu</Button>
              )}
              {selected.can_check_in && selected.kind === "matricula" && !enrolling && !noShow && (
                <Button onClick={() => { setEnrollCount("1"); setEnrolling(true); }}>Matriculado</Button>
              )}
              {selected.can_check_in && !confirming && !enrolling && !noShow && (
                <Button variant="danger" onClick={() => setNoShow(true)}>Faltou</Button>
              )}
              <Button variant="outline" onClick={() => { setSelected(null); setConfirming(false); setNoShow(false); setEnrolling(false); }}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { setLeadCheckIn } from "@/lib/ext/cadastros.functions";
import { listCalendarEvents, markEnrollmentDone, markVisitNoShow, type CalendarEvent } from "@/lib/ext/calendario.functions";


function waLink(phone: string | null) {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length >= 10 ? `https://wa.me/55${d}` : null;
}

export function usePendingAttendance(enabled: boolean) {
  return useQuery({
    queryKey: ["calendar", "pending-attendance"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const today = new Date(new Date().toDateString());
      const from = new Date(today.getTime() - 120 * 86400000);
      const r = await listCalendarEvents({ data: { from: from.toISOString(), to: today.toISOString() } });
      return r.events.filter((e) => e.status === "missed" && e.can_check_in);
    },
  });
}

export function PendingAttendanceSection({ enabled }: { enabled: boolean }) {
  const { data = [] } = usePendingAttendance(enabled);
  const qc = useQueryClient();
  const [enrollFor, setEnrollFor] = useState<string | null>(null);
  const [count, setCount] = useState("1");
  const [noShowFor, setNoShowFor] = useState<string | null>(null);


  const refresh = () => {
    for (const k of ["calendar", "pipeline", "submissions", "crm-tasks", "crm-notes", "notes"]) qc.invalidateQueries({ queryKey: [k] });
  };
  const checkIn = useMutation({
    mutationFn: (e: CalendarEvent) => setLeadCheckIn({ data: { id: e.submission_id } }),
    onSuccess: () => { toast.success("Comparecimento registrado."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const enroll = useMutation({
    mutationFn: (id: string) => markEnrollmentDone({ data: { opportunity_id: id, count: Number(count) } }),
    onSuccess: () => { toast.success("Matrícula confirmada."); setEnrollFor(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const noShow = useMutation({
    mutationFn: (id: string) => markVisitNoShow({ data: { opportunity_id: id } }),
    onSuccess: () => { toast.success("Falta registrada."); setNoShowFor(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data.length) return <p className="p-6 text-center text-sm text-muted-foreground">Nada pendente.</p>;
  const busy = checkIn.isPending || enroll.isPending || noShow.isPending;

  return (
    <>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {data.map((e) => {
            const wa = waLink(e.phone);
            return (
              <li key={e.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {format(new Date(e.at), "dd/MM/yyyy HH:mm", { locale: ptBR })} - {e.kind === "visita" ? "Visita" : "Matrícula"}
                    </p>
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.school_name}{e.series?.length ? ` · ${e.series.join(", ")}` : ""}
                    </p>
                    {e.phone && (
                      <p className="flex items-center gap-1 text-xs">
                        {e.phone}
                        {wa && <a href={wa} target="_blank" rel="noreferrer" className="text-green-600" aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></a>}
                      </p>
                    )}
                  </div>
                  {enrollFor !== e.id && noShowFor !== e.id && (
                    <div className="flex gap-2">
                      <Button
                        disabled={busy}
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={() => (e.kind === "visita" ? checkIn.mutate(e) : (setCount("1"), setEnrollFor(e.id)))}
                      >
                        Compareceu
                      </Button>
                      <Button variant="danger" disabled={busy} onClick={() => setNoShowFor(e.id)}>Faltou</Button>
                    </div>
                  )}
                </div>
                {enrollFor === e.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                    <span className="text-sm">Quantas matrículas foram efetivadas?</span>
                    <Input type="number" min={1} step={1} value={count} onChange={(ev) => setCount(ev.target.value)} className="w-24" />
                    <Button variant="ghost" onClick={() => setEnrollFor(null)}>Cancelar</Button>
                    <Button disabled={busy || !Number.isInteger(Number(count)) || Number(count) < 1} onClick={() => enroll.mutate(e.id)}>Confirmar</Button>
                  </div>
                )}
                {noShowFor === e.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                    <span className="text-sm">Confirmar falta? O cartão irá para reagendamento.</span>
                    <Button variant="ghost" onClick={() => setNoShowFor(null)}>Cancelar</Button>
                    <Button variant="danger" disabled={busy} onClick={() => noShow.mutate(e.id)}>Confirmar falta</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
    </>
  );
}

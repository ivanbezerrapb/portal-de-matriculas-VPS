import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { asksEnrollment } from "@/lib/ext/close-access";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MessageCircle, Plus, Trash2 } from "lucide-react";
import { listFunnelOwners, listFunnels } from "@/lib/ext/funis.functions";
import {
  closeOpportunity,
  createOpportunity,
  deleteOpportunity,
  getOpportunityCustomer,
  listPipeline,
  moveOpportunity,
  reopenOpportunity,
  setOpportunityOwner,
} from "@/lib/ext/pipeline.functions";
import { listCloseReasons } from "@/lib/ext/motivos.functions";
import { createTask, deleteTask, listTasks, setTaskDone } from "@/lib/ext/tarefas.functions";
import { listTaskTypes } from "@/lib/ext/atividades.functions";
import { CompleteTaskDialog } from "@/components/CompleteTaskDialog";
import { createNote, deleteNote, listNotes } from "@/lib/ext/notas.functions";
import { getMyPermissions, getSubmission, updateSubmission } from "@/lib/ext/cadastros.functions";
import { isChildrenCountField, type FormField } from "@/lib/ext/model";
import { FieldRenderer } from "@/components/FieldRenderer";
import { setOpportunityVisit } from "@/lib/ext/pipeline.functions";
import { getCardMaxbotStatus, listCardMaxbotTemplates, sendCardMaxbotTemplate, transferCardMaxbotProtocol } from "@/lib/ext/maxbot.functions";
import { Button, Card, EmptyState, Input, Label, Select, Spinner, Textarea } from "@/components/ui";

// Monta o link do WhatsApp: DDI 55 + DDD e número do cadastro.
function whatsappHref(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length < 10 || digits.length > 11) return null;
  return `https://wa.me/55${digits}`;
}

// Situação do contato no Maxbot (consulta e, se faltar, cadastra ao abrir o card).
function useMaxbotStatus(opportunityId: string) {
  return useQuery({
    queryKey: ["maxbot-card", opportunityId],
    queryFn: () => getCardMaxbotStatus({ data: { opportunity_id: opportunityId } }),
    staleTime: 60_000,
    retry: false,
  });
}

function MaxbotBadge({ opportunityId }: { opportunityId: string }) {
  const { data, isLoading, isError, error } = useMaxbotStatus(opportunityId);
  if (isError)
    return <span title={error instanceof Error ? error.message : undefined} className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">Erro no Maxbot</span>;
  if (isLoading) return <span className="text-[11px] text-muted-foreground">Maxbot…</span>;
  if (data?.status === "linked")
    return (
      <span title={`Cadastrado no ${data.account_label ?? "Maxbot"} (ID ${data.contact_id})`} className="inline-flex items-center rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-success-foreground">
        Maxbot
      </span>
    );
  const label = data?.status === "not_configured" ? "Maxbot não configurado" : data?.status === "no_phone" ? "Telefone inválido p/ Maxbot" : data?.status === "error" ? "Erro no Maxbot" : "Sem Maxbot";
  return <span title={data?.error ?? undefined} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>;
}

function MaxbotSend({ opportunityId }: { opportunityId: string }) {
  const qc = useQueryClient();
  const { data: status, refetch, isFetching } = useMaxbotStatus(opportunityId);
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState("");
  const [asUser, setAsUser] = useState("");
  const [busy, setBusy] = useState<{ attendant_name: string | null; prot_id: string | null } | null>(null);
  const tq = useQuery({
    queryKey: ["maxbot-templates", opportunityId],
    queryFn: () => listCardMaxbotTemplates({ data: { opportunity_id: opportunityId } }),
    enabled: open,
    retry: false,
  });
  useEffect(() => { if (open && !tpl && tq.data?.default_template_id && tq.data.templates.some((t) => t.id === tq.data!.default_template_id)) setTpl(tq.data.default_template_id); }, [open, tq.data, tpl]);
  const chosen = tq.data?.templates.find((t) => t.id === tpl);
  const isAdm = !!tq.data?.is_admin;
  const selfId = tq.data?.attendants.find((a) => a.attendant_name === tq.data?.attendant?.name && tq.data?.attendant)?.user_id ?? "";
  const sender = isAdm ? (asUser || selfId) : "";
  const canSend = isAdm ? !!sender : !!tq.data?.attendant;
  const sendM = useMutation({
    mutationFn: () => sendCardMaxbotTemplate({ data: { opportunity_id: opportunityId, template_id: tpl, template_title: chosen?.title ?? tpl, ...(sender ? { as_user_id: sender } : {}) } }),
    onSuccess: (r) => {
      if (r.busy) { setOpen(false); setBusy({ attendant_name: r.attendant_name, prot_id: r.prot_id }); return; }
      toast.success(`Mensagem enviada${r.protocol ? ` (protocolo ${r.protocol})` : ""}.`);
      setOpen(false); setTpl(""); setAsUser("");
      qc.invalidateQueries({ queryKey: ["crm-notes", opportunityId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar."),
  });
  const trM = useMutation({
    mutationFn: () => transferCardMaxbotProtocol({ data: { opportunity_id: opportunityId, prot_id: busy?.prot_id ?? "", ...(sender ? { as_user_id: sender } : {}) } }),
    onSuccess: () => {
      toast.success("Conversa transferida. O contato já aparece no seu painel do Maxbot.");
      setBusy(null); setTpl(""); setAsUser("");
      qc.invalidateQueries({ queryKey: ["crm-notes", opportunityId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao transferir."),
  });
  const linked = status?.status === "linked";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button onClick={() => setOpen(true)} disabled={!linked}>
        <MessageCircle className="mr-1 h-4 w-4" /> Enviar mensagem
      </Button>
      {(status?.status === "missing" || status?.status === "error") && (
        <Button variant="secondary" disabled={isFetching} onClick={() => refetch()}>Cadastrar no Maxbot</Button>
      )}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-foreground">Confirmar envio pelo Maxbot</h3>
            {tq.isLoading ? <div className="mt-4"><Spinner /></div> : tq.error ? (
              <p className="mt-3 text-sm text-destructive">{tq.error instanceof Error ? tq.error.message : "Falha ao carregar templates."}</p>
            ) : tq.data && (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-muted-foreground">Conta: <span className="text-foreground">{tq.data.account_label}</span></p>
                {isAdm ? (
                  <div>
                    <Label htmlFor="mb-as">Enviar como</Label>
                    <Select id="mb-as" value={sender} onChange={(e) => setAsUser(e.target.value)}>
                      <option value="">Selecione…</option>
                      {tq.data.attendants.map((a) => <option key={a.user_id} value={a.user_id}>{a.user_name} — atendente {a.attendant_name}</option>)}
                    </Select>
                    {tq.data.attendants.length === 0 && <p className="mt-1 text-xs text-destructive">Nenhum usuário vinculado a atendente desta conta.</p>}
                  </div>
                ) : tq.data.attendant ? (
                  <p className="text-muted-foreground">Enviando como: <span className="text-foreground">{tq.data.attendant.name}</span></p>
                ) : (
                  <p className="text-destructive">Seu usuário não está vinculado a um atendente deste Maxbot. Peça ao administrador em Configurações › Usuários.</p>
                )}
                {chosen ? (
                  <p className="text-foreground">Tem certeza que deseja enviar o template <span className="font-semibold">"{chosen.title}"</span> para este contato?</p>
                ) : (
                  <p className="text-destructive">{tq.data.default_template_id ? "O template padrão não pode ser disparado. Escolha um template de Follow-up ou Aviso em Configurações › MAXBOT." : "Nenhum template padrão definido. Peça ao administrador em Configurações › MAXBOT."}</p>
                )}
                {chosen && <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-foreground">{chosen.msg}</div>}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button disabled={!chosen || !canSend || sendM.isPending} onClick={() => sendM.mutate()}>
                {sendM.isPending ? "Enviando…" : "Sim, enviar"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {busy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4" onClick={() => setBusy(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-foreground">Contato já em atendimento</h3>
            <p className="mt-3 text-sm text-foreground">
              Não foi possível enviar esta mensagem agora porque o contato já está em conversa aberta no Maxbot com o(a) atendente{" "}
              <span className="font-semibold">{busy.attendant_name || "não identificado"}</span>.
            </p>
            {busy.prot_id ? (
              <p className="mt-3 text-sm text-foreground">Deseja transferir esta conversa para o seu usuário no Maxbot?</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Não foi possível identificar a conversa aberta para transferir. Tente novamente quando ela for encerrada.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBusy(null)}>{busy.prot_id ? "Cancelar" : "Fechar"}</Button>
              {busy.prot_id && (
                <Button disabled={trM.isPending} onClick={() => trM.mutate()}>{trM.isPending ? "Transferindo…" : "Transferir para mim"}</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Edição dos dados do cadastro direto no cartão (mesmos campos do formulário).
function SubmissionEditForm({
  submissionId,
  onDone,
}: {
  submissionId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => getSubmission({ data: { id: submissionId } }),
  });
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  useEffect(() => {
    if (!data) return;
    const map: Record<string, string | string[]> = {};
    for (const v of data.values) {
      const field = (data.fields as FormField[]).find((f) => f.id === v.field_id);
      let val: string | string[] = v.value ?? "";
      if (field?.type === "multiple_choice") {
        try {
          val = JSON.parse(v.value ?? "[]");
        } catch {
          val = [];
        }
      }
      map[v.field_id] = val;
    }
    setValues(map);
  }, [data]);
  const saveM = useMutation({
    mutationFn: () => updateSubmission({ data: { id: submissionId, values } }),
    onSuccess: (r) => {
      toast.success(r.changed > 0 ? "Dados atualizados." : "Nada foi alterado.");
      queryClient.invalidateQueries();
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading || !data) return <div className="mt-2"><Spinner /></div>;
  const fields = (data.fields as FormField[]).filter((f) => !isChildrenCountField(f));
  return (
    <form
      className="mt-3 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        saveM.mutate();
      }}
    >
      {fields.map((field) => (
        <FieldRenderer
          key={field.id}
          field={field}
          value={values[field.id] ?? (field.type === "multiple_choice" ? [] : "")}
          onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
        />
      ))}
      <div className="flex gap-2">
        <Button type="submit" disabled={saveM.isPending}>Salvar</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

function OpportunityCustomer({
  opportunityId,
  submissionId,
  canEdit,
  showBadge,
}: {
  opportunityId: string;
  submissionId?: string | null;
  canEdit?: boolean;
  showBadge?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["opp-customer", opportunityId],
    queryFn: () => getOpportunityCustomer({ data: { opportunity_id: opportunityId } }),
  });
  const phoneIdx = data?.items.findIndex((it) => it.type === "phone" || /telefone|whats|celular/i.test(it.label)) ?? -1;
  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-foreground">Dados do cliente</h3>
        {canEdit && submissionId && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
      </div>
      {editing && submissionId ? (
        <SubmissionEditForm submissionId={submissionId} onDone={() => setEditing(false)} />
      ) : isLoading ? (
        <div className="mt-2"><Spinner /></div>
      ) : error ? (
        <p className="mt-2 text-sm text-destructive">Não foi possível carregar os dados.</p>
      ) : !data?.items.length ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma resposta registrada.</p>
      ) : (
        <dl className="mt-2 space-y-3 text-sm">
          {data.items.map((it, i) => (
            <div key={i}>
              <dt className="text-xs text-muted-foreground">{it.label}</dt>
              <dd className="break-words text-foreground">
                {it.lines.map((l, j) => (
                  <div key={j} className="flex items-center gap-2">
                    {l}
                    {it.type === "phone" && whatsappHref(l) && (
                      <a
                        href={whatsappHref(l)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Abrir conversa no WhatsApp"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    {showBadge && j === 0 && i === phoneIdx && <MaxbotBadge opportunityId={opportunityId} />}
                  </div>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}


export const Route = createFileRoute("/_authenticated/crm/pipeline")({
  validateSearch: (search: Record<string, unknown>) => ({
    funil: typeof search["funil"] === "string" ? (search["funil"] as string) : undefined,
    card: typeof search["card"] === "string" ? (search["card"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pipeline — Grupo Inter" },
      {
        name: "description",
        content: "Acompanhe as oportunidades de matrícula por etapa do funil.",
      },
      { property: "og:title", content: "Pipeline — Grupo Inter" },
      {
        property: "og:description",
        content: "Acompanhe as oportunidades de matrícula por etapa do funil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

// Cor da data da atividade: no prazo cinza, hoje verde, vencida vermelha.
function activityColor(due: string | null): string {
  if (!due) return "text-muted-foreground";
  const today = new Date();
  const hoje = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (due === hoje) return "text-emerald-600";
  if (due < hoje) return "text-destructive";
  return "text-muted-foreground";
}

function PipelinePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { funil, card } = Route.useSearch();
  const [dragging, setDragging] = useState<string | null>(null);
  const [newIn, setNewIn] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(card ?? null);
  const [statusFilter, setStatusFilter] = useState<"open" | "won" | "lost">("open");
  const [closing, setClosing] = useState<{ id: string; result: "won" | "lost" } | null>(null);

  // Abre o painel quando o endereço traz ?card=... (ex.: vindo da tela Tarefas).
  useEffect(() => {
    if (card) setOpenCard(card);
  }, [card]);

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const isDirecao = perms?.isDirecao ?? false;
  // Direção acompanha o CRM apenas em leitura.
  const canWrite = !isDirecao;
  const canClose = (perms?.isAdmin ?? false) && canWrite;
  // Perda: Admin, Gerente da unidade e Central de Informações (servidor confere o vínculo ao funil).
  const canLose = (schoolId: string) =>
    canWrite &&
    ((perms?.isAdmin ?? false) ||
      (perms?.managerSchools ?? []).includes(schoolId) ||
      ((perms as { infoSchools?: string[] } | undefined)?.infoSchools ?? []).includes(schoolId));
  // Ganho: mesma regra da perda (Admin, Gerente da unidade e Central de Informações).
  const canWin = (schoolId: string) => canLose(schoolId);

  const funnelsQuery = useQuery({ queryKey: ["funnels"], queryFn: () => listFunnels() });
  const allFunnels = funnelsQuery.data?.funnels ?? [];

  // Responsáveis (Central de Informações) vinculados a cada funil.
  const ownersQuery = useQuery({ queryKey: ["funnel-owners"], queryFn: () => listFunnelOwners() });
  const owners = ownersQuery.data ?? [];
  const canFilterOwner =
    (perms?.isAdmin || perms?.isDirecao || (perms?.managerSchools.length ?? 0) > 0) ?? false;
  const [ownerFilter, setOwnerFilter] = useState("all");
  const ownerOptions = Array.from(new Map(owners.map((o) => [o.user_id, o.name])).entries()).sort(
    (a, b) => a[1].localeCompare(b[1]),
  );

  const funnels =
    ownerFilter === "all"
      ? allFunnels
      : allFunnels.filter((f) =>
          owners.some((o) => o.user_id === ownerFilter && o.funnel_id === f.id),
        );
  const selected = funil ?? funnels.find((f) => f.is_default)?.id ?? funnels[0]?.id;
  const selectedOwners = owners.filter((o) => o.funnel_id === selected).map((o) => o.name);

  const pipelineQuery = useQuery({
    queryKey: ["pipeline", selected, statusFilter],
    queryFn: () => listPipeline({ data: { funnel_id: selected!, status: statusFilter } }),
    enabled: Boolean(selected),
    // Atualiza sozinho, mas pausa durante arraste, criação ou painel aberto.
    refetchInterval: dragging || newIn || openCard || closing ? false : 30_000,
    refetchIntervalInBackground: false,
  });

  const stages = pipelineQuery.data?.stages ?? [];
  const opportunities = pipelineQuery.data?.opportunities ?? [];
  const nextTasks = pipelineQuery.data?.nextTasks ?? {};

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["pipeline", selected] });
  }

  const [pendingMove, setPendingMove] = useState<
    { id: string; stage_id: string; position: number } | null
  >(null);
  const [pendingOwner, setPendingOwner] = useState("");
  const moveM = useMutation({
    mutationFn: (d: { id: string; stage_id: string; position: number; owner_id?: string }) =>
      moveOpportunity({ data: d }),
    onSuccess: () => {
      setPendingMove(null);
      refresh();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });

  // Mover para "Visita agendada" (cartões de LEADS) exige a data da visita.
  type MoveData = { id: string; stage_id: string; position: number; owner_id?: string };
  const [visitMove, setVisitMove] = useState<MoveData | null>(null);
  const [visitValue, setVisitValue] = useState("");
  const [visitKind, setVisitKind] = useState<"visita" | "matricula">("visita");
  function needsVisit(cardId: string, stageId: string) {
    const card = opportunities.find((o) => o.id === cardId);
    const stage = stages.find((s) => s.id === stageId);
    if (!card || !stage || card.stage_id === stageId) return false;
    const name = stage.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (card.submissions?.list_type === "leads") return name.includes("visita agendada");
    return name.includes("matricula agendada");
  }
  function openVisitMove(move: MoveData) {
    const card = opportunities.find((o) => o.id === move.id);
    let initial = "";
    if (card?.visit_at) {
      const d = new Date(card.visit_at);
      const p = (n: number) => String(n).padStart(2, "0");
      initial = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    setVisitValue(initial);
    setVisitKind(card?.submissions?.list_type === "leads" ? "visita" : "matricula");
    setVisitMove(move);
  }
  const visitMoveM = useMutation({
    mutationFn: async () => {
      if (!visitMove || !visitValue) throw new Error("Informe a data.");
      await setOpportunityVisit({
        data: { id: visitMove.id, visit_at: new Date(visitValue).toISOString() },
      });
      await moveOpportunity({ data: visitMove });
    },
    onSuccess: () => {
      toast.success(visitKind === "visita" ? "Visita agendada." : "Matrícula agendada.");
      setVisitMove(null);
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });

  const createM = useMutation({
    mutationFn: (d: {
      stage_id: string;
      name: string;
      phone: string;
      email: string;
      notes: string;
      owner_id?: string | null;
    }) => createOpportunity({ data: d }),
    onSuccess: () => {
      toast.success("Oportunidade criada.");
      setNewIn(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (d: { id: string }) => deleteOpportunity({ data: d }),
    onSuccess: () => {
      toast.success("Oportunidade removida.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeM = useMutation({
    mutationFn: (d: {
      id: string;
      result: "won" | "lost";
      reason_id: string;
      note?: string;
      enrollment_count?: number;
    }) => closeOpportunity({ data: d }),
    onSuccess: () => {
      toast.success("Oportunidade fechada.");
      setClosing(null);
      setOpenCard(null);
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopenM = useMutation({
    mutationFn: (d: { id: string }) => reopenOpportunity({ data: d }),
    onSuccess: () => {
      toast.success("Oportunidade reaberta.");
      setOpenCard(null);
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ownerM = useMutation({
    mutationFn: (d: { id: string; owner_id: string | null }) => setOpportunityOwner({ data: d }),
    onSuccess: () => {
      toast.success("Responsável atualizado.");
      refresh();
      queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">CRM</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste os cartões entre as etapas para atualizar o atendimento.
          </p>
          {selectedOwners.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Responsável: <span className="text-foreground">{selectedOwners.join(", ")}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40">
            <Label>Situação</Label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="open">Em aberto</option>
              <option value="won">Ganhas</option>
              <option value="lost">Perdidas</option>
            </Select>
          </div>
          {canFilterOwner && ownerOptions.length > 0 && (
            <div className="min-w-48">
              <Label>Responsável</Label>
              <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                <option value="all">Todos</option>
                {ownerOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="min-w-56">
            <Label>Funil</Label>
            <Select
              value={selected ?? ""}
              onChange={(e) =>
                navigate({
                  to: "/crm/pipeline",
                  search: { funil: e.target.value || undefined, card: undefined },
                })
              }
            >
              <option value="">Selecione um funil…</option>
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {funnelsQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : funnels.length === 0 ? (
        <EmptyState
          title="Nenhum funil disponível"
          description={
            (perms?.infoSchools.length ?? 0) > 0
              ? "Nenhum funil foi atribuído ao seu usuário. Peça ao Administrador para liberar os funis que você irá atender."
              : "Crie um funil em CRM › Funil para começar a acompanhar as oportunidades."
          }
        />
      ) : !selected ? (
        <EmptyState
          title="Selecione um funil"
          description="Escolha um funil acima para ver as etapas e as oportunidades."
        />
      ) : pipelineQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const cards = opportunities
              .filter((o) => o.stage_id === stage.id)
              .sort((a, b) => a.position - b.position);
            return (
              <div
                key={stage.id}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragging || statusFilter !== "open" || !canWrite) return;
                  const moving = opportunities.find((o) => o.id === dragging) as
                    | (typeof opportunities)[number] & { owner_confirmed_at?: string | null }
                    | undefined;
                  const move = { id: dragging, stage_id: stage.id, position: cards.length };
                  if (moving && moving.stage_id !== stage.id && !moving.owner_confirmed_at) {
                    setPendingMove(move);
                    setPendingOwner(moving.owner_id ?? "");
                  } else if (needsVisit(move.id, move.stage_id)) {
                    openVisitMove(move);
                  } else {
                    moveM.mutate(move);
                  }
                  setDragging(null);
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <p className="flex-1 text-sm font-semibold text-foreground">{stage.name}</p>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                    {cards.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  {cards.map((card) => {
                    const activity = nextTasks[card.id];
                     const cardSeries = card.series ?? [];
                    const body = (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="break-words text-sm font-semibold text-foreground">
                            {card.display_name}
                          </p>
                          {card.restricted && (
                            <span
                              title="Pendência pedagógica — atenção"
                              aria-label="Pendência pedagógica"
                              className="shrink-0 text-[oklch(0.72_0.18_60)]"
                            >
                              <AlertTriangle size={16} strokeWidth={2} />
                            </span>
                          )}
                        </div>
                        {cardSeries.length > 0 && (
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Série:</span>{" "}
                            {cardSeries.join(" · ")}
                          </p>
                        )}
                        {card.phone && (
                          <p className="text-xs text-muted-foreground">{card.phone}</p>
                        )}
                        {card.visit_at && (
                          <p className="mt-1 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-900">
                            Visita: {new Date(card.visit_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: `${stage.color}1a`, color: stage.color }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </span>
                          {activity ? (
                            <span
                              className={`text-[11px] font-medium ${activityColor(activity.due_date)}`}
                            >
                              {activity.title}
                              {activity.due_date
                                ? ` · ${new Date(`${activity.due_date}T00:00:00`).toLocaleDateString("pt-BR")}`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Sem atividade</span>
                          )}
                        </div>
                        {card.status !== "open" && (
                          <p
                            className={`mt-2 text-[11px] font-semibold ${
                              card.status === "won" ? "text-emerald-600" : "text-destructive"
                            }`}
                          >
                            {card.status === "won" ? "Ganha" : "Perdida"}
                            {card.crm_close_reasons?.label
                              ? ` · ${card.crm_close_reasons.label}`
                              : ""}
                          </p>
                        )}
                      </>
                    );
                    return (
                      <div
                        key={card.id}
                        draggable={statusFilter === "open" && canWrite}
                        onDragStart={() => setDragging(card.id)}
                        onDragEnd={() => setDragging(null)}
                        className="group rounded-lg border border-border bg-card p-3 shadow-sm"
                      >
                        <button
                          type="button"
                          className="block w-full cursor-pointer text-left"
                          onClick={() => setOpenCard(card.id)}
                        >
                          {body}
                        </button>
                        {statusFilter === "open" && canWrite && (
                          <button
                            type="button"
                            aria-label="Remover oportunidade"
                            className="mt-2 hidden text-xs text-destructive group-hover:inline-flex"
                            onClick={() => deleteM.mutate({ id: card.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {statusFilter === "open" && canWrite ? (
                  newIn === stage.id ? (
                    <form
                      className="mt-2 space-y-2 rounded-lg border border-border bg-card p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget as HTMLFormElement);
                        createM.mutate({
                          stage_id: stage.id,
                          name: String(fd.get("name") ?? ""),
                          phone: String(fd.get("phone") ?? ""),
                          email: String(fd.get("email") ?? ""),
                          notes: String(fd.get("notes") ?? ""),
                          owner_id: String(fd.get("owner_id") ?? "") || null,
                        });
                      }}
                    >
                      <Input name="name" placeholder="Nome" required />
                      <Input name="phone" placeholder="Telefone" />
                      <Input name="email" placeholder="E-mail" />
                      <Select name="owner_id" defaultValue="">
                        <option value="">Sem responsável</option>
                        {owners
                          .filter((owner) => owner.funnel_id === selected)
                          .map((owner) => (
                            <option key={owner.user_id} value={owner.user_id}>
                              {owner.name}
                            </option>
                          ))}
                      </Select>
                      <Textarea name="notes" rows={2} placeholder="Observação" />
                      <div className="flex gap-2">
                        <Button type="submit" disabled={createM.isPending}>
                          Salvar
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setNewIn(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      variant="ghost"
                      className="mt-2 w-full justify-start text-muted-foreground"
                      onClick={() => setNewIn(stage.id)}
                    >
                      <Plus className="h-4 w-4" /> Nova oportunidade
                    </Button>
                  )
                ) : null}
              </div>
            );
          })}
          {stages.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">
                Este funil ainda não tem etapas. Adicione etapas em CRM › Funil.
              </p>
            </Card>
          )}
        </div>
      )}

      {(() => {
        const card = opportunities.find((o) => o.id === openCard);
        if (!card) return null;
        const stage = stages.find((s) => s.id === card.stage_id);
        const cardSeries = card.series ?? [];
        const details = (card.details ?? []) as { label: string; value: string }[];
        const wide = !!perms?.isAdmin || !!perms?.infoSchools?.includes(card.school_id);
        const canEditData =
          !!perms &&
          (perms.isAdmin ||
            perms.managerSchools.includes(card.school_id) ||
            perms.infoSchools.includes(card.school_id));
        return (
          <div
            className={`fixed inset-0 z-50 flex bg-foreground/40 ${wide ? "items-center justify-center p-4" : "justify-end"}`}
            onClick={() => setOpenCard(null)}
          >
            <div
              className={
                wide
                  ? "h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl"
                  : "h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl"
              }
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-display text-xl font-bold text-foreground">
                    {card.display_name}
                  </h2>
                  {cardSeries.length > 0 && (
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Série:</span>{" "}
                      {cardSeries.join(" · ")}
                    </p>
                  )}
                </div>
                <Button variant="ghost" onClick={() => setOpenCard(null)}>
                  Fechar
                </Button>
              </div>

              {stage && (
                <span
                  className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: `${stage.color}1a`, color: stage.color }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </span>
              )}

              <div className="mt-4">
                <Label htmlFor="card-owner">Responsável</Label>
                <Select
                  id="card-owner"
                  value={card.owner_id ?? ""}
                  disabled={!canWrite || ownerM.isPending}
                  onChange={(event) =>
                    ownerM.mutate({ id: card.id, owner_id: event.target.value || null })
                  }
                >
                  <option value="">Sem responsável</option>
                  {owners
                    .filter((owner) => owner.funnel_id === card.funnel_id)
                    .map((owner) => (
                      <option key={owner.user_id} value={owner.user_id}>
                        {owner.name}
                      </option>
                    ))}
                </Select>
              </div>

              <dl className="mt-4 space-y-3 text-sm">
                {card.phone && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Telefone</dt>
                    <dd className="flex items-center gap-2 text-foreground">
                      {card.phone}
                      {whatsappHref(card.phone) && (
                        <a
                          href={whatsappHref(card.phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir conversa no WhatsApp"
                          aria-label="Abrir conversa no WhatsApp"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      <MaxbotBadge opportunityId={card.id} />
                    </dd>
                  </div>
                )}

                {card.email && (
                  <div>
                    <dt className="text-xs text-muted-foreground">E-mail</dt>
                    <dd className="text-foreground">{card.email}</dd>
                  </div>
                )}
                {details.map((d, i) => {
                  const lines = d.value.split(" | ").filter(Boolean);
                  return (
                    <div key={i}>
                      <dt className="text-xs text-muted-foreground">{d.label}</dt>
                      <dd className="text-foreground">
                        {lines.map((line, j) => (
                          <div key={j}>{line}</div>
                        ))}
                      </dd>
                    </div>
                  );
                })}
                {card.notes && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Observação</dt>
                    <dd className="whitespace-pre-line text-foreground">{card.notes}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Entrada</dt>
                  <dd className="text-foreground">{formatDate(card.created_at)}</dd>
                </div>
                {card.status !== "open" && (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">Resultado</dt>
                      <dd
                        className={`font-semibold ${
                          card.status === "won" ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {card.status === "won" ? "Ganha" : "Perdida"}
                        {card.crm_close_reasons?.label ? ` · ${card.crm_close_reasons.label}` : ""}
                      </dd>
                    </div>
                    {card.close_note && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Observação do fechamento</dt>
                        <dd className="whitespace-pre-line text-foreground">{card.close_note}</dd>
                      </div>
                    )}
                    {card.closed_at && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Fechada em</dt>
                        <dd className="text-foreground">{formatDate(card.closed_at)}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>

              <div className={wide ? "grid gap-x-8 lg:grid-cols-2" : ""}>
              <div>
              {card.submission_id && (
                <OpportunityCustomer
                  opportunityId={card.id}
                  submissionId={card.submission_id}
                  canEdit={canEditData}
                  showBadge={!card.phone}
                />
              )}

              {card.submission_id &&
                (perms?.isAdmin || (perms?.managerSchools.length ?? 0) > 0 || (perms?.operatorSchools.length ?? 0) > 0) && (
                <Link
                  to="/cadastros/$submissionId"
                  params={{ submissionId: card.submission_id }}
                  className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                >
                  Ver ficha completa
                </Link>
              )}

              {(card.phone || card.submission_id) && <MaxbotSend opportunityId={card.id} />}

              </div>
              <div>
              {card.submission_id && (
                <OpportunityVisit
                  opportunityId={card.id}
                  visitAt={card.visit_at ?? null}
                  canWrite={canWrite}
                  kind={card.submissions?.list_type === "leads" ? "visita" : "matricula"}
                />
              )}

              <OpportunityTasks opportunityId={card.id} canWrite={canWrite} />

              <OpportunityNotes opportunityId={card.id} canWrite={canWrite} />
              </div>
              </div>

              {card.status === "open"
                ? canLose(card.school_id) && (
                    <div className="mt-6 flex gap-2 border-t border-border pt-4">
                      {canWin(card.school_id) && (
                        <Button
                          variant="outline"
                          className="flex-1 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setClosing({ id: card.id, result: "won" })}
                        >
                          Marcar como ganha
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => setClosing({ id: card.id, result: "lost" })}
                      >
                        Marcar como perdida
                      </Button>
                    </div>
                  )
                : canClose && (
                    <div className="mt-6 border-t border-border pt-4">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => reopenM.mutate({ id: card.id })}
                        disabled={reopenM.isPending}
                      >
                        Reabrir oportunidade
                      </Button>
                    </div>
                  )}
            </div>
          </div>
        );
      })()}

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">Confirmar responsável</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Antes do primeiro movimento, confirme quem é o responsável por este cartão.
            </p>
            {(() => {
              const list = owners.filter((o) => o.funnel_id === selected);
              return list.length === 0 ? (
                <p className="mt-4 text-sm text-destructive">
                  Este funil não tem responsáveis vinculados. Vincule um usuário ao funil em Usuários.
                </p>
              ) : (
                <select
                  className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={pendingOwner}
                  onChange={(e) => setPendingOwner(e.target.value)}
                >
                  <option value="">Selecione o responsável…</option>
                  {list.map((o) => (
                    <option key={o.user_id} value={o.user_id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              );
            })()}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingMove(null)} disabled={moveM.isPending}>
                Cancelar
              </Button>
              <Button
                disabled={!pendingOwner || moveM.isPending}
                onClick={() => {
                  const next = { ...pendingMove, owner_id: pendingOwner };
                  if (needsVisit(next.id, next.stage_id)) {
                    setPendingMove(null);
                    openVisitMove(next);
                  } else {
                    moveM.mutate(next);
                  }
                }}
              >
                Confirmar e mover
              </Button>
            </div>
          </div>
        </div>
      )}

      {visitMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">{visitKind === "visita" ? "Agendar visita" : "Agendar matrícula"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe a data e a hora {visitKind === "visita" ? "da visita" : "da matrícula"} para mover o cartão.
            </p>
            <Input
              type="datetime-local"
              className="mt-4"
              value={visitValue}
              onChange={(e) => setVisitValue(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setVisitMove(null)}
                disabled={visitMoveM.isPending}
              >
                Cancelar
              </Button>
              <Button
                disabled={!visitValue || visitMoveM.isPending}
                onClick={() => visitMoveM.mutate()}
              >
                Agendar e mover
              </Button>
            </div>
          </div>
        </div>
      )}

      {closing && (
        <CloseDialog
          result={closing.result}
          linkedSubmission={asksEnrollment(
            opportunities.find((opportunity) => opportunity.id === closing.id) ?? null,
          )}
          childrenCount={
            opportunities.find((opportunity) => opportunity.id === closing.id)?.submissions
              ?.children_count ?? null
          }
          saving={closeM.isPending}
          onCancel={() => setClosing(null)}
          onConfirm={(reasonId, note, enrollmentCount) =>
            closeM.mutate({
              id: closing.id,
              result: closing.result,
              reason_id: reasonId,
              note,
              ...(enrollmentCount == null ? {} : { enrollment_count: enrollmentCount }),
            })
          }
        />
      )}
    </div>
  );
}

function OpportunityTasks({
  opportunityId,
  canWrite,
}: {
  opportunityId: string;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [completing, setCompleting] = useState<{ id: string; title: string } | null>(null);
  const { data: taskTypes } = useQuery({
    queryKey: ["task-types", "active"],
    queryFn: () => listTaskTypes({ data: { activeOnly: true } }),
  });

  const { data: tasks } = useQuery({
    queryKey: ["crm-tasks", "opp", opportunityId],
    queryFn: () => listTasks({ data: { opportunity_id: opportunityId } }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
  }

  const createM = useMutation({
    mutationFn: () =>
      createTask({ data: { opportunity_id: opportunityId, title, due_date: due || null } }),
    onSuccess: () => {
      setTitle("");
      setDue("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const doneM = useMutation({
    mutationFn: (d: { id: string; done: boolean; note?: string }) => setTaskDone({ data: d }),
    onSuccess: () => {
      setCompleting(null);
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["crm-notes", opportunityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (d: { id: string }) => deleteTask({ data: d }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-6 border-t border-border pt-4">
      {completing && (
        <CompleteTaskDialog
          taskTitle={completing.title}
          saving={doneM.isPending}
          onCancel={() => setCompleting(null)}
          onConfirm={(note) => doneM.mutate({ id: completing.id, done: true, note })}
        />
      )}
      <h3 className="text-sm font-semibold text-foreground">Tarefas</h3>
      <ul className="mt-2 space-y-2">
        {(tasks ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--color-primary)]"
              checked={t.done}
              disabled={!canWrite}
              onChange={(e) =>
                e.target.checked
                  ? setCompleting({ id: t.id, title: t.title })
                  : doneM.mutate({ id: t.id, done: false })
              }
              aria-label={t.done ? "Reabrir tarefa" : "Concluir tarefa"}
            />
            <span
              className={`flex-1 ${
                t.done ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              {t.title}
              {t.due_date && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({new Date(`${t.due_date}T00:00:00`).toLocaleDateString("pt-BR")})
                </span>
              )}
            </span>
            {canWrite && (
              <button
                type="button"
                aria-label="Excluir tarefa"
                className="rounded p-1 text-muted-foreground hover:text-destructive"
                onClick={() => deleteM.mutate({ id: t.id })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {(tasks ?? []).length === 0 && (
          <li className="text-xs text-muted-foreground">Nenhuma tarefa ainda.</li>
        )}
      </ul>
      {canWrite && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            createM.mutate();
          }}
        >
          <Select value={title} onChange={(e) => setTitle(e.target.value)}>
            <option value="">Selecione a atividade…</option>
            {(taskTypes ?? []).map((t) => (
              <option key={t.id} value={t.label}>
                {t.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <Button type="submit" disabled={createM.isPending || !title.trim()}>
              Adicionar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function CloseDialog(props: {
  result: "won" | "lost";
  linkedSubmission: boolean;
  childrenCount: number | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (reasonId: string, note: string, enrollmentCount?: number) => void;
}) {
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [enrollmentCount, setEnrollmentCount] = useState(
    String(Math.max(props.childrenCount ?? 1, 1)),
  );
  const { data: reasons, isLoading } = useQuery({
    queryKey: ["close-reasons", "active"],
    queryFn: () => listCloseReasons({ data: { activeOnly: true } }),
  });
  const options = (reasons ?? []).filter((r) => r.kind === props.result);
  const isWon = props.result === "won";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4"
      onClick={props.onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold text-foreground">
          {isWon ? "Marcar como ganha" : "Marcar como perdida"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o motivo {isWon ? "do ganho" : "da perda"}.
        </p>
        {isLoading ? (
          <div className="mt-4 flex justify-center">
            <Spinner />
          </div>
        ) : options.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum motivo ativo. Cadastre em CRM › Motivos.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <Select value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
              <option value="">Selecione o motivo…</option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
            {isWon && props.linkedSubmission && (
              <div>
                <Label htmlFor="crm-enrollment-count">Matrículas efetivadas</Label>
                <Input
                  id="crm-enrollment-count"
                  type="number"
                  min={1}
                  step={1}
                  value={enrollmentCount}
                  onChange={(event) => setEnrollmentCount(event.target.value)}
                />
                {props.childrenCount != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {props.childrenCount} criança{props.childrenCount === 1 ? "" : "s"} informada
                    {props.childrenCount === 1 ? "" : "s"} no cadastro.
                  </p>
                )}
              </div>
            )}
            <Textarea
              rows={2}
              placeholder="Observação (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={props.onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={
              !reasonId ||
              props.saving ||
              (isWon &&
                props.linkedSubmission &&
                (!Number.isInteger(Number(enrollmentCount)) || Number(enrollmentCount) < 1))
            }
            onClick={() =>
              props.onConfirm(
                reasonId,
                note,
                isWon && props.linkedSubmission ? Number(enrollmentCount) : undefined,
              )
            }
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

// Histórico de informações do cartão: cada registro guarda nome, data e hora.
function OpportunityNotes({
  opportunityId,
  canWrite,
}: {
  opportunityId: string;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: notes } = useQuery({
    queryKey: ["crm-notes", opportunityId],
    queryFn: () => listNotes({ data: { opportunity_id: opportunityId } }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["crm-notes", opportunityId] });
  }

  const createM = useMutation({
    mutationFn: () => createNote({ data: { opportunity_id: opportunityId, body } }),
    onSuccess: () => {
      setBody("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (d: { id: string }) => deleteNote({ data: d }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-6 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">Histórico</h3>

      {canWrite && (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            createM.mutate();
          }}
        >
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva aqui a informação a registrar…"
          />
          <Button type="submit" disabled={createM.isPending || !body.trim()} className="self-start">
            Registrar
          </Button>
        </form>
      )}

      <ul className="mt-3 space-y-3">
        {(notes ?? []).map((n) => (
          <li key={n.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {n.author_name ?? "Usuário"} ·{" "}
                {new Date(n.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {canWrite && n.can_delete && (
                <button
                  type="button"
                  aria-label="Excluir registro"
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteM.mutate({ id: n.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-line text-foreground">{n.body}</p>
          </li>
        ))}
        {(notes ?? []).length === 0 && (
          <li className="text-xs text-muted-foreground">Nenhum registro ainda.</li>
        )}
      </ul>
    </section>
  );
}

function OpportunityVisit({ opportunityId, visitAt, canWrite, kind }: { opportunityId: string; visitAt: string | null; canWrite: boolean; kind: "visita" | "matricula" }) {
  const label = kind === "visita" ? "visita" : "matrícula";
  const queryClient = useQueryClient();
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(visitAt ? toLocal(visitAt) : "");
  const m = useMutation({
    mutationFn: (v: string | null) => setOpportunityVisit({ data: { id: opportunityId, visit_at: v } }),
    onSuccess: (_r, v) => {
      toast.success(v ? (kind === "visita" ? "Visita agendada." : "Matrícula agendada.") : "Agendamento removido.");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="font-display text-sm font-semibold text-foreground">Data da {label}</h3>
      {visitAt && !editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-900">
            {new Date(visitAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </span>
          {canWrite && (
            <>
              <Button variant="outline" onClick={() => { setValue(toLocal(visitAt)); setEditing(true); }}>Alterar</Button>
              <Button variant="ghost" disabled={m.isPending} onClick={() => m.mutate(null)}>Remover agendamento</Button>
            </>
          )}
        </div>
      ) : !canWrite ? (
        <p className="mt-2 text-sm text-muted-foreground">Sem {label} agendada.</p>
      ) : editing || !visitAt ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-60" />
          <Button disabled={!value || m.isPending} onClick={() => m.mutate(new Date(value).toISOString())}>
            Agendar {label}
          </Button>
          {editing && <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}
        </div>
      ) : null}
    </div>
  );
}

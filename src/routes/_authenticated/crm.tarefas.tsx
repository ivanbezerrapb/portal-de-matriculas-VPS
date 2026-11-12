import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteTask, listTasks, setTaskDone, type TaskRow } from "@/lib/ext/tarefas.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { listFunnelOwners, listFunnels } from "@/lib/ext/funis.functions";
import { Badge, Button, Card, EmptyState, Label, Select, Spinner } from "@/components/ui";
import { CompleteTaskDialog } from "@/components/CompleteTaskDialog";

export const Route = createFileRoute("/_authenticated/crm/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — Grupo Inter" },
      { name: "description", content: "Acompanhe as tarefas das oportunidades do CRM." },
      { property: "og:title", content: "Tarefas — Grupo Inter" },
      { property: "og:description", content: "Acompanhe as tarefas das oportunidades do CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TarefasPage,
});

function taskDate(t: TaskRow) {
  if (!t.due_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${t.due_date}T00:00:00`);
  const overdue = !t.done && due < today;
  return { text: due.toLocaleDateString("pt-BR"), overdue };
}

function TarefasPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "done" | "all">("pending");
  const [schoolId, setSchoolId] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  // Direção acompanha as tarefas apenas em leitura.
  const canWrite = !(perms?.isDirecao ?? false);

  const { data: schools } = useQuery({ queryKey: ["schools"], queryFn: () => listSchools() });
  const { data: funnelsData } = useQuery({ queryKey: ["funnels"], queryFn: () => listFunnels() });
  const { data: owners } = useQuery({
    queryKey: ["funnel-owners"],
    queryFn: () => listFunnelOwners(),
  });
  const funnels = (funnelsData?.funnels ?? []).filter(
    (funnel) => !schoolId || funnel.school_id === schoolId,
  );
  const ownerOptions = Array.from(
    new Map(
      (owners ?? [])
        .filter((owner) => !funnelId || owner.funnel_id === funnelId)
        .filter((owner) => {
          if (!schoolId) return true;
          return funnels.some((funnel) => funnel.id === owner.funnel_id);
        })
        .map((owner) => [owner.user_id, owner.name]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["crm-tasks", filter, schoolId, funnelId, ownerId],
    queryFn: () =>
      listTasks({
        data: {
          ...(filter === "all" ? {} : { done: filter === "done" }),
          ...(schoolId ? { school_id: schoolId } : {}),
          ...(funnelId ? { funnel_id: funnelId } : {}),
          ...(ownerId === "unassigned"
            ? { unassigned: true }
            : ownerId
              ? { owner_id: ownerId }
              : {}),
        },
      }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
  }

  const [completing, setCompleting] = useState<{ id: string; title: string } | null>(null);
  const doneM = useMutation({
    mutationFn: (d: { id: string; done: boolean; note?: string }) => setTaskDone({ data: d }),
    onSuccess: () => {
      setCompleting(null);
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["crm-notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (d: { id: string }) => deleteTask({ data: d }),
    onSuccess: () => {
      toast.success("Tarefa removida.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      {completing && (
        <CompleteTaskDialog
          taskTitle={completing.title}
          saving={doneM.isPending}
          onCancel={() => setCompleting(null)}
          onConfirm={(note) => doneM.mutate({ id: completing.id, done: true, note })}
        />
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">CRM</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Afazeres das oportunidades, ordenados por data.
          </p>
        </div>
      </div>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="task-status">Situação</Label>
            <Select
              id="task-status"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="pending">Pendentes</option>
              <option value="done">Feitas</option>
              <option value="all">Todas</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-school">Escola</Label>
            <Select
              id="task-school"
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value);
                setFunnelId("");
                setOwnerId("");
              }}
            >
              <option value="">Todas</option>
              {(schools ?? []).map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="task-funnel">Funil</Label>
            <Select
              id="task-funnel"
              value={funnelId}
              onChange={(e) => {
                setFunnelId(e.target.value);
                setOwnerId("");
              }}
            >
              <option value="">Todos</option>
              {funnels.map((funnel) => (
                <option key={funnel.id} value={funnel.id}>
                  {funnel.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="task-owner">Responsável</Label>
            <Select id="task-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Todos</option>
              <option value="unassigned">Sem responsável</option>
              {ownerOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nenhuma tarefa"
            description="As tarefas são criadas no painel da oportunidade, no CRM › Pipeline."
          />
        </div>
      ) : (
        <Card className="mt-4 p-0">
          <ul className="divide-y divide-border">
            {tasks.map((t) => {
              const d = taskDate(t);
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
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
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        t.done ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.opportunities?.name ?? "Oportunidade"}
                      {d && (
                        <span className={d.overdue ? "font-semibold text-destructive" : ""}>
                          {" · "}
                          {d.text}
                          {d.overdue && " (atrasada)"}
                        </span>
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge color="muted">
                        Funil: {t.opportunities?.funnels?.name ?? "Sem funil"}
                      </Badge>
                      <Badge color={t.opportunities?.owner ? "green" : "amber"}>
                        Responsável: {t.opportunities?.owner?.full_name ?? "Sem responsável"}
                      </Badge>
                    </div>
                  </div>
                  {t.opportunities && (
                    <Link
                      to="/crm/pipeline"
                      search={{ funil: undefined, card: t.opportunities.id }}
                    >
                      <Button variant="outline" className="text-xs">
                        Abrir
                      </Button>
                    </Link>
                  )}
                  {canWrite && (
                    <button
                      type="button"
                      aria-label="Excluir tarefa"
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteM.mutate({ id: t.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

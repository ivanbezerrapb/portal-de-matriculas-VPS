import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import {
  createTaskType,
  deleteTaskType,
  listTaskTypes,
  moveTaskType,
  updateTaskType,
} from "@/lib/ext/atividades.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { Button, Card, Input, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/crm/atividades")({
  head: () => ({
    meta: [
      { title: "Atividades das tarefas — Grupo Inter" },
      { name: "description", content: "Cadastre as atividades disponíveis nas tarefas do CRM." },
      { property: "og:title", content: "Atividades das tarefas — Grupo Inter" },
      {
        property: "og:description",
        content: "Cadastre as atividades disponíveis nas tarefas do CRM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AtividadesPage,
});

function AtividadesPage() {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const { data: types, isLoading } = useQuery({
    queryKey: ["task-types"],
    queryFn: () => listTaskTypes({ data: {} }),
  });
  const isAdmin = perms?.isAdmin ?? false;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["task-types"] });
  const onError = (e: Error) => toast.error(e.message);

  const createM = useMutation({
    mutationFn: () => createTaskType({ data: { label } }),
    onSuccess: () => {
      setLabel("");
      refresh();
    },
    onError,
  });
  const updateM = useMutation({
    mutationFn: (d: { id: string; label?: string; active?: boolean }) =>
      updateTaskType({ data: d }),
    onSuccess: refresh,
    onError,
  });
  const moveM = useMutation({
    mutationFn: (d: { id: string; direction: "up" | "down" }) => moveTaskType({ data: d }),
    onSuccess: refresh,
    onError,
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteTaskType({ data: { id } }),
    onSuccess: refresh,
    onError,
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-sm font-medium text-primary">CRM</p>
      <h1 className="font-display text-2xl font-bold text-foreground">Atividades</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Opções que aparecem ao criar uma tarefa no cartão.
      </p>
      <Card className="mt-6">
        {isLoading ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-border">
            {(types ?? []).map((t, i, arr) => (
              <li key={t.id} className="flex items-center gap-2 py-2">
                <Input
                  defaultValue={t.label}
                  disabled={!isAdmin}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.label) updateM.mutate({ id: t.id, label: v });
                  }}
                  className={t.active ? "" : "opacity-50"}
                />
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      aria-label="Subir"
                      disabled={i === 0}
                      className="rounded p-1 text-muted-foreground disabled:opacity-30"
                      onClick={() => moveM.mutate({ id: t.id, direction: "up" })}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Descer"
                      disabled={i === arr.length - 1}
                      className="rounded p-1 text-muted-foreground disabled:opacity-30"
                      onClick={() => moveM.mutate({ id: t.id, direction: "down" })}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => updateM.mutate({ id: t.id, active: !t.active })}
                    >
                      {t.active ? "Desativar" : "Ativar"}
                    </Button>
                    <button
                      type="button"
                      aria-label="Excluir"
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir "${t.label}"?`)) deleteM.mutate(t.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (label.trim()) createM.mutate();
            }}
          >
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nova atividade…"
            />
            <Button type="submit" disabled={!label.trim() || createM.isPending}>
              Adicionar
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

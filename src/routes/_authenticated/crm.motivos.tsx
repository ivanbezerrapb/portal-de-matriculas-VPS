import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CheckCircle2, Trash2, XCircle } from "lucide-react";
import {
  createCloseReason,
  deleteCloseReason,
  listCloseReasons,
  moveCloseReason,
  updateCloseReason,
} from "@/lib/ext/motivos.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import type { CloseReason } from "@/lib/ext/model";
import { Button, Card, Input, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/crm/motivos")({
  head: () => ({
    meta: [
      { title: "Motivos de ganho e perda — Grupo Inter" },
      { name: "description", content: "Cadastre os motivos de ganho e perda das oportunidades." },
      { property: "og:title", content: "Motivos de ganho e perda — Grupo Inter" },
      {
        property: "og:description",
        content: "Cadastre os motivos de ganho e perda das oportunidades.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MotivosPage,
});

function MotivosPage() {
  const queryClient = useQueryClient();
  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const { data: reasons, isLoading } = useQuery({
    queryKey: ["close-reasons"],
    queryFn: () => listCloseReasons({ data: {} }),
  });

  const isAdmin = perms?.isAdmin ?? false;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["close-reasons"] });
  }

  const createM = useMutation({
    mutationFn: (d: { kind: "won" | "lost"; label: string }) => createCloseReason({ data: d }),
    onSuccess: () => {
      toast.success("Motivo adicionado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateM = useMutation({
    mutationFn: (d: { id: string; label?: string; active?: boolean }) =>
      updateCloseReason({ data: d }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const moveM = useMutation({
    mutationFn: (d: { id: string; direction: "up" | "down" }) => moveCloseReason({ data: d }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (d: { id: string }) => deleteCloseReason({ data: d }),
    onSuccess: () => {
      toast.success("Motivo removido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const won = (reasons ?? []).filter((r) => r.kind === "won");
  const lost = (reasons ?? []).filter((r) => r.kind === "lost");

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-medium text-primary">CRM</p>
      <h1 className="font-display text-2xl font-bold text-foreground">Motivos de ganho e perda</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Estes motivos aparecem na hora de marcar uma oportunidade como ganha ou perdida.
        {!isAdmin && " Somente administradores podem alterar."}
      </p>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <ReasonSection
            title="Ganho"
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            kind="won"
            reasons={won}
            canEdit={isAdmin}
            onCreate={(label) => createM.mutate({ kind: "won", label })}
            onToggle={(r) => updateM.mutate({ id: r.id, active: !r.active })}
            onRename={(r, label) => updateM.mutate({ id: r.id, label })}
            onMove={(r, direction) => moveM.mutate({ id: r.id, direction })}
            onDelete={(r) => {
              if (window.confirm(`Excluir o motivo "${r.label}"?`)) deleteM.mutate({ id: r.id });
            }}
          />
          <ReasonSection
            title="Perda"
            icon={<XCircle className="h-5 w-5 text-destructive" />}
            kind="lost"
            reasons={lost}
            canEdit={isAdmin}
            onCreate={(label) => createM.mutate({ kind: "lost", label })}
            onToggle={(r) => updateM.mutate({ id: r.id, active: !r.active })}
            onRename={(r, label) => updateM.mutate({ id: r.id, label })}
            onMove={(r, direction) => moveM.mutate({ id: r.id, direction })}
            onDelete={(r) => {
              if (window.confirm(`Excluir o motivo "${r.label}"?`)) deleteM.mutate({ id: r.id });
            }}
          />
        </div>
      )}
    </div>
  );
}

function ReasonSection(props: {
  title: string;
  icon: React.ReactNode;
  kind: "won" | "lost";
  reasons: CloseReason[];
  canEdit: boolean;
  onCreate: (label: string) => void;
  onToggle: (r: CloseReason) => void;
  onRename: (r: CloseReason, label: string) => void;
  onMove: (r: CloseReason, direction: "up" | "down") => void;
  onDelete: (r: CloseReason) => void;
}) {
  const [label, setLabel] = useState("");
  const { canEdit } = props;

  return (
    <Card>
      <div className="flex items-center gap-2">
        {props.icon}
        <h2 className="font-display text-lg font-semibold text-foreground">
          Motivos de {props.title.toLowerCase()}
        </h2>
      </div>

      <ul className="mt-4 space-y-2">
        {props.reasons.map((r, i) => (
          <li
            key={r.id}
            className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 ${
              r.active ? "bg-card" : "bg-muted/50 opacity-60"
            }`}
          >
            {canEdit ? (
              <Input
                defaultValue={r.label}
                className="h-8 flex-1"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== r.label) props.onRename(r, v);
                }}
              />
            ) : (
              <span className="flex-1 text-sm text-foreground">{r.label}</span>
            )}
            {canEdit && (
              <>
                <button
                  type="button"
                  aria-label="Mover para cima"
                  disabled={i === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                  onClick={() => props.onMove(r, "up")}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Mover para baixo"
                  disabled={i === props.reasons.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                  onClick={() => props.onMove(r, "down")}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  onClick={() => props.onToggle(r)}
                >
                  {r.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  aria-label="Excluir motivo"
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                  onClick={() => props.onDelete(r)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
        {props.reasons.length === 0 && (
          <li className="text-sm text-muted-foreground">Nenhum motivo cadastrado.</li>
        )}
      </ul>

      {canEdit && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = label.trim();
            if (!v) return;
            props.onCreate(v);
            setLabel("");
          }}
        >
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Novo motivo de ${props.title.toLowerCase()}…`}
          />
          <Button type="submit">Adicionar</Button>
        </form>
      )}
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createFunnel,
  createStage,
  deleteFunnel,
  deleteStage,
  duplicateFunnel,
  listFunnels,
  reorderStages,
  updateFunnel,
  updateStage,
} from "@/lib/ext/funis.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { getMyPermissions } from "@/lib/ext/cadastros.functions";
import { funnelListType, type Funnel, type FunnelStage } from "@/lib/ext/model";
import { Button, Card, EmptyState, Input, Label, Select, Spinner, Textarea } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/crm/funil")({
  head: () => ({
    meta: [
      { title: "Funil — Grupo Inter" },
      {
        name: "description",
        content: "Crie funis por escola e organize as etapas de atendimento.",
      },
      { property: "og:title", content: "Funil — Grupo Inter" },
      {
        property: "og:description",
        content: "Crie funis por escola e organize as etapas de atendimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FunilPage,
});

const STAGE_COLORS = ["#1e40af", "#0284c7", "#7c3aed", "#d97706", "#059669", "#dc2626", "#475569"];

type StageDraft = { name: string; description: string; color: string };
const emptyStage: StageDraft = { name: "", description: "", color: STAGE_COLORS[0]! };

function StageForm({
  value,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  value: StageDraft;
  saving: boolean;
  submitLabel: string;
  onSubmit: (draft: StageDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<StageDraft>(value);
  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="flex flex-wrap gap-3">
        <div className="min-w-48 flex-1">
          <Label>Nome da etapa</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>Cor</Label>
          <div className="flex min-h-11 items-center gap-2">
            {STAGE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                onClick={() => setDraft({ ...draft, color: c })}
                className={
                  "h-7 w-7 rounded-full border-2 transition " +
                  (draft.color === c ? "border-foreground" : "border-transparent")
                }
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function FunilPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [funnelForm, setFunnelForm] = useState({ school_id: "", name: "", description: "" });
  const [editingFunnel, setEditingFunnel] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [fSchool, setFSchool] = useState("");
  const [fKind, setFKind] = useState("");

  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });
  const isAdmin = perms?.isAdmin ?? false;

  const schoolsQuery = useQuery({ queryKey: ["schools"], queryFn: () => listSchools() });
  const funnelsQuery = useQuery({ queryKey: ["funnels"], queryFn: () => listFunnels() });

  const schools = schoolsQuery.data ?? [];
  const funnels: Funnel[] = funnelsQuery.data?.funnels ?? [];
  const stages: FunnelStage[] = funnelsQuery.data?.stages ?? [];

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["funnels"] });
  }

  function useAction<T>(fn: (input: T) => Promise<unknown>, message: string) {
    return useMutation({
      mutationFn: (input: T) => fn(input),
      onSuccess: () => {
        toast.success(message);
        refresh();
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  const createFunnelM = useAction(
    (d: { school_id: string; name: string; description: string }) => createFunnel({ data: d }),
    "Funil criado.",
  );
  const updateFunnelM = useAction(
    (d: {
      id: string;
      school_id: string;
      name: string;
      description: string;
      is_default: boolean;
    }) => updateFunnel({ data: d }),
    "Funil atualizado.",
  );
  const duplicateFunnelM = useAction(
    (d: { id: string }) => duplicateFunnel({ data: d }),
    "Funil duplicado.",
  );
  const deleteFunnelM = useAction(
    (d: { id: string }) => deleteFunnel({ data: d }),
    "Funil excluído.",
  );
  const createStageM = useAction(
    (d: { funnel_id: string } & StageDraft) => createStage({ data: d }),
    "Etapa adicionada.",
  );
  const updateStageM = useAction(
    (d: { id: string } & StageDraft) => updateStage({ data: d }),
    "Etapa atualizada.",
  );
  const deleteStageM = useAction(
    (d: { id: string }) => deleteStage({ data: d }),
    "Etapa removida.",
  );
  const reorderM = useAction(
    (d: { funnel_id: string; ids: string[] }) => reorderStages({ data: d }),
    "Ordem atualizada.",
  );

  function stagesOf(funnelId: string) {
    return stages.filter((s) => s.funnel_id === funnelId).sort((a, b) => a.position - b.position);
  }

  function move(funnelId: string, list: FunnelStage[], index: number, delta: number) {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    reorderM.mutate({ funnel_id: funnelId, ids: next.map((s) => s.id) });
  }

  const shownFunnels = funnels.filter(
    (f) => (!fSchool || f.school_id === fSchool) && (!fKind || funnelListType(f.name) === fKind),
  );
  const loading = funnelsQuery.isLoading || schoolsQuery.isLoading;
  const current = funnels.find((f) => f.id === editingFunnel) ?? null;

  if (current) {
    const funnelStages = stagesOf(current.id);
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setEditingFunnel(null)} className="mb-2 px-0">
            <ArrowLeft className="h-4 w-4" /> Voltar para os funis
          </Button>
          <p className="text-sm font-medium text-primary">CRM › Funil</p>
          <h1 className="font-display text-2xl font-bold text-foreground">{current.name}</h1>
        </div>

        <Card>
          <h2 className="mb-3 font-display text-base font-semibold text-foreground">
            Dados do funil
          </h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget as HTMLFormElement);
              updateFunnelM.mutate({
                id: current.id,
                name: String(fd.get("name") ?? ""),
                school_id: String(fd.get("school_id") ?? ""),
                description: String(fd.get("description") ?? ""),
                is_default: fd.get("is_default") === "on",
              });
            }}
          >
            <div className="flex flex-wrap gap-3">
              <div className="min-w-48 flex-1">
                <Label>Nome do funil</Label>
                <Input name="name" defaultValue={current.name} required disabled={!isAdmin} />
              </div>
              <div className="min-w-48 flex-1">
                <Label>Escola</Label>
                <Select
                  name="school_id"
                  defaultValue={current.school_id}
                  required
                  disabled={!isAdmin}
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                name="description"
                rows={2}
                defaultValue={current.description ?? ""}
                disabled={!isAdmin}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="is_default"
                defaultChecked={current.is_default}
                disabled={!isAdmin}
                className="h-4 w-4"
              />
              Funil padrão desta escola (recebe os novos cadastros)
            </label>
            {isAdmin && (
              <Button type="submit" disabled={updateFunnelM.isPending}>
                Salvar
              </Button>
            )}
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-base font-semibold text-foreground">Etapas</h2>
          <div className="space-y-2">
            {funnelStages.map((stage, index) =>
              editingStage === stage.id ? (
                <StageForm
                  key={stage.id}
                  value={{
                    name: stage.name,
                    description: stage.description ?? "",
                    color: stage.color,
                  }}
                  saving={updateStageM.isPending}
                  submitLabel="Salvar etapa"
                  onCancel={() => setEditingStage(null)}
                  onSubmit={(draft) =>
                    updateStageM.mutate(
                      { id: stage.id, ...draft },
                      { onSuccess: () => setEditingStage(null) },
                    )
                  }
                />
              ) : (
                <div
                  key={stage.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-semibold text-foreground">{stage.name}</p>
                    {stage.description && (
                      <p className="text-xs text-muted-foreground">{stage.description}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        aria-label="Mover para cima"
                        disabled={index === 0}
                        onClick={() => move(current.id, funnelStages, index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Mover para baixo"
                        disabled={index === funnelStages.length - 1}
                        onClick={() => move(current.id, funnelStages, index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Editar etapa"
                        onClick={() => setEditingStage(stage.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Remover etapa"
                        onClick={() => deleteStageM.mutate({ id: stage.id })}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ),
            )}

            {isAdmin &&
              (addingStage ? (
                <StageForm
                  value={emptyStage}
                  saving={createStageM.isPending}
                  submitLabel="Adicionar etapa"
                  onCancel={() => setAddingStage(false)}
                  onSubmit={(draft) =>
                    createStageM.mutate(
                      { funnel_id: current.id, ...draft },
                      { onSuccess: () => setAddingStage(false) },
                    )
                  }
                />
              ) : (
                <Button variant="outline" onClick={() => setAddingStage(true)}>
                  <Plus className="h-4 w-4" /> Adicionar etapa
                </Button>
              ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">CRM</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Funil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada escola pode ter seus próprios funis com etapas de atendimento.
          </p>
        </div>
        {isAdmin && !creating && (
          <Button
            onClick={() => {
              setFunnelForm({ school_id: schools[0]?.id ?? "", name: "", description: "" });
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo funil
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createFunnelM.mutate(funnelForm, { onSuccess: () => setCreating(false) });
            }}
          >
            <div className="flex flex-wrap gap-3">
              <div className="min-w-48 flex-1">
                <Label>Nome do funil</Label>
                <Input
                  value={funnelForm.name}
                  onChange={(e) => setFunnelForm({ ...funnelForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="min-w-48 flex-1">
                <Label>Escola</Label>
                <Select
                  value={funnelForm.school_id}
                  onChange={(e) => setFunnelForm({ ...funnelForm, school_id: e.target.value })}
                  required
                >
                  <option value="">Selecione…</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={funnelForm.description}
                onChange={(e) => setFunnelForm({ ...funnelForm, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createFunnelM.isPending}>
                Criar funil
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!loading && funnels.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <Label htmlFor="ff-school">Unidade</Label>
            <Select id="ff-school" value={fSchool} onChange={(e) => setFSchool(e.target.value)}>
              <option value="">Todas</option>
              {schools.filter((s) => funnels.some((f) => f.school_id === s.id)).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <Label htmlFor="ff-kind">Tipo</Label>
            <Select id="ff-kind" value={fKind} onChange={(e) => setFKind(e.target.value)}>
              <option value="">Todos</option>
              <option value="leads">LEADS</option>
              <option value="visitantes">Visitantes (Pós Visita)</option>
            </Select>
          </div>
          <span className="pb-2 text-sm text-muted-foreground">
            {shownFunnels.length} funil{shownFunnels.length === 1 ? "" : "s"}
          </span>
          {(fSchool || fKind) && (
            <Button variant="outline" onClick={() => { setFSchool(""); setFKind(""); }}>Limpar filtros</Button>
          )}
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : funnels.length === 0 ? (
        <EmptyState
          title="Nenhum funil criado"
          description={
            isAdmin
              ? "Crie o primeiro funil para organizar as etapas de atendimento da escola."
              : "Nenhum funil disponível para a sua escola por enquanto."
          }
        />
      ) : (
        <div className="space-y-3">
          {shownFunnels.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum funil para este filtro.</p>
          )}
          {shownFunnels.map((funnel) => {
            const funnelStages = stagesOf(funnel.id);
            const school = schools.find((s) => s.id === funnel.school_id);
            return (
              <Card key={funnel.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-56 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold text-foreground">
                        {funnel.name}
                      </h2>
                      {funnel.is_default && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Padrão da escola
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {school?.name ?? "Escola não encontrada"}
                      {funnel.description ? ` · ${funnel.description}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {funnelStages.map((s) => (
                        <span
                          key={s.id}
                          title={s.name}
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {funnelStages.length} etapa{funnelStages.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        aria-label="Editar funil"
                        onClick={() => {
                          setEditingStage(null);
                          setAddingStage(false);
                          setEditingFunnel(funnel.id);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Duplicar funil"
                        onClick={() => duplicateFunnelM.mutate({ id: funnel.id })}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Excluir funil"
                        onClick={() => {
                          if (confirm(`Excluir o funil "${funnel.name}" e suas etapas?`))
                            deleteFunnelM.mutate({ id: funnel.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

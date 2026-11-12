import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  deletePrintTemplate,
  getForm,
  saveFormFields,
  setFormStatus,
  updateFormInfo,
} from "@/lib/ext/formularios.functions";
import { applyTemplateToForm, listTemplates } from "@/lib/ext/templates.functions";
import {
  FIELD_TYPE_LABELS,
  fieldOptionsWithAddressParts,
  isChildrenCountField,
  joinChildOptions,
  splitChildOptions,
  type FieldType,
  type FormField,
  type PrintTemplate,
} from "@/lib/ext/model";
import { Badge, Button, Card, Input, Label, Select, Spinner, Textarea } from "@/components/ui";
import { publicFormUrl } from "@/lib/publicFormUrl";
import {
  getDestination,
  reprocessSubmissions,
  saveDestination,
  saveRules,
} from "@/lib/ext/destino.functions";
import {
  CONDITION_OP_LABELS,
  SUBMISSION_ID_FIELD,
  type ConditionOp,
  type DestinationCondition,
} from "@/lib/ext/destino";

export const Route = createFileRoute("/_authenticated/formularios_/$formId")({
  head: () => ({
    meta: [
      { title: "Configurar formulário — Grupo Inter" },
      { name: "description", content: "Configure campos, publicação e impressão do formulário." },
      { property: "og:title", content: "Configurar formulário — Grupo Inter" },
      {
        property: "og:description",
        content: "Configure campos, publicação e impressão do formulário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormConfigPage,
});

const FIELD_TYPES = Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][];
const NEEDS_OPTIONS: FieldType[] = ["single_choice", "multiple_choice"];

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  closed: "Encerrado",
};
const STATUS_COLOR: Record<string, "amber" | "green" | "muted"> = {
  draft: "amber",
  published: "green",
  closed: "muted",
};

type EditableField = Omit<FormField, "form_id">;

function FormConfigPage() {
  const { formId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["form", formId],
    queryFn: () => getForm({ data: { id: formId } }),
  });
  const [tab, setTab] = useState<"campos" | "impressao" | "publicar" | "destino">("campos");

  if (isLoading || !data) {
    return (
      <div className="mt-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const school = data.form.schools as unknown as { name: string } | null;

  return (
    <div className={tab === "impressao" ? "w-full" : "mx-auto max-w-4xl"}>
      <Link to="/formularios" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar para formulários
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground">{data.form.title}</h1>
        <Badge color={STATUS_COLOR[data.form.status] ?? "muted"}>
          {STATUS_LABEL[data.form.status] ?? data.form.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{school?.name ?? ""}</p>

      <div className="mt-6 flex gap-1 border-b border-border">
        {(
          [
            ["campos", "Campos"],
            ["impressao", "Modelos de impressão"],
            ["publicar", "Publicar"],
            ["destino", "Destino"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "campos" && <FieldsTab formId={formId} initialFields={data.fields as FormField[]} />}
      {tab === "impressao" && (
        <TemplatesTab formId={formId} templates={data.templates as PrintTemplate[]} />
      )}
      {tab === "publicar" && (
        <PublishTab
          formId={formId}
          form={data.form}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ["form", formId] })}
        />
      )}
      {tab === "destino" && (
        <DestinationTab formId={formId} schoolId={data.form.school_id as string} />
      )}
    </div>
  );
}

// ---------- Aba Campos ----------

function FieldsTab({ formId, initialFields }: { formId: string; initialFields: FormField[] }) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<EditableField[]>(
    initialFields.filter((f) => !isChildrenCountField(f)).map(({ ...f }) => f),
  );
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFormFields({
        data: {
          form_id: formId,
          fields: fields.map((f, i) => ({
            id: f.id,
            label: f.label,
            help_text: f.help_text,
            type: f.type,
            options: f.options,
            required: f.required,
            internal: f.internal,
            position: i,
          })),
          deleted_ids: deletedIds,
        },
      }),
    onSuccess: () => {
      toast.success("Campos salvos.");
      setDeletedIds([]);
      queryClient.invalidateQueries({ queryKey: ["form", formId] });
    },
    onError: (e) => toast.error(e.message),
  });

  function updateField(id: string, patch: Partial<EditableField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function move(id: string, dir: -1 | 1) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const item = next[idx];
      if (!item) return prev;
      next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Campos internos não aparecem no link público — só a equipe preenche.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setFields((prev) => [
                ...prev,
                {
                  id: `new-${crypto.randomUUID()}`,
                  label: "",
                  help_text: null,
                  type: "short_text",
                  options: null,
                  required: false,
                  internal: false,
                  position: prev.length,
                },
              ])
            }
          >
            + Adicionar campo
          </Button>
          <Button
            onClick={() => {
              if (fields.some((f) => !f.label.trim())) {
                toast.error("Preencha o nome de todos os campos.");
                return;
              }
              saveMut.mutate();
            }}
            disabled={saveMut.isPending}
          >
            Salvar campos
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {fields.length === 0 && (
          <Card>
            <p className="text-sm text-muted-foreground">
              Nenhum campo ainda. Clique em "Adicionar campo".
            </p>
          </Card>
        )}
        {fields.map((field, idx) => (
          <Card key={field.id}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <Label>Nome do campo</Label>
                <Input
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  placeholder="Ex.: Nome do aluno"
                />
              </div>
              <div className="w-44">
                <Label>Tipo</Label>
                <Select
                  value={field.type}
                  onChange={(e) => {
                    const type = e.target.value as FieldType;
                    updateField(field.id, {
                      type,
                      options:
                        NEEDS_OPTIONS.includes(type) || type === "children"
                          ? (field.options ?? [])
                          : null,
                    });
                  }}
                >
                  {FIELD_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-4 pb-2 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-primary)]"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  />
                  Obrigatório
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-primary)]"
                    checked={field.internal}
                    onChange={(e) => updateField(field.id, { internal: e.target.checked })}
                  />
                  Campo interno
                </label>
              </div>
              <div className="flex gap-1 pb-1">
                <Button variant="ghost" onClick={() => move(field.id, -1)} disabled={idx === 0}>
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => move(field.id, 1)}
                  disabled={idx === fields.length - 1}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!field.id.startsWith("new-")) {
                      setDeletedIds((prev) => [...prev, field.id]);
                    }
                    setFields((prev) => prev.filter((f) => f.id !== field.id));
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="min-w-48 flex-1">
                <Label>Texto de ajuda (opcional)</Label>
                <Input
                  value={field.help_text ?? ""}
                  onChange={(e) => updateField(field.id, { help_text: e.target.value || null })}
                  placeholder="Ex.: Como está no documento oficial"
                />
              </div>
              {NEEDS_OPTIONS.includes(field.type) && (
                <div className="min-w-48 flex-1">
                  <Label>Opções (uma por linha)</Label>
                  <Textarea
                    rows={3}
                    value={(field.options ?? []).join("\n")}
                    onChange={(e) =>
                      updateField(field.id, {
                        options: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              )}
              {field.type === "children" && (
                <>
                  <div className="min-w-48 flex-1">
                    <Label>Séries (uma por linha)</Label>
                    <Textarea
                      rows={3}
                      value={splitChildOptions(field.options).series.join("\n")}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: joinChildOptions(
                            e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                            splitChildOptions(field.options).turnos,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="min-w-48 flex-1">
                    <Label>Turnos (um por linha)</Label>
                    <Textarea
                      rows={3}
                      value={splitChildOptions(field.options).turnos.join("\n")}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: joinChildOptions(
                            splitChildOptions(field.options).series,
                            e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          ),
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Aba Modelos de impressão ----------

function TemplatesTab({ formId, templates }: { formId: string; templates: PrintTemplate[] }) {
  const queryClient = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePrintTemplate({ data: { id } }),
    onSuccess: () => {
      toast.success("Modelo removido deste formulário.");
      queryClient.invalidateQueries({ queryKey: ["form", formId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: library } = useQuery({
    queryKey: ["template-library"],
    queryFn: () => listTemplates(),
  });
  const [libraryId, setLibraryId] = useState("");

  const applyMut = useMutation({
    mutationFn: (templateId: string) =>
      applyTemplateToForm({
        data: { template_id: templateId, form_id: formId },
      }),
    onSuccess: () => {
      toast.success("Template associado a este formulário.");
      setLibraryId("");
      queryClient.invalidateQueries({ queryKey: ["form", formId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        Os modelos de impressão são criados no menu{" "}
        <Link to="/templates" className="text-primary hover:underline">
          Templates
        </Link>
        . Aqui você apenas associa um template a este formulário.
      </p>

      <Card className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Label>Associar um template</Label>
          <Select value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
            <option value="">Selecione um template…</option>
            {(library ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="secondary"
          disabled={!libraryId || applyMut.isPending}
          onClick={() => applyMut.mutate(libraryId)}
        >
          Associar a este formulário
        </Button>
      </Card>

      <div className="mt-4 flex flex-col gap-3">
        {templates.length === 0 && (
          <Card>
            <p className="text-sm text-muted-foreground">Nenhum template associado ainda.</p>
          </Card>
        )}
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {t.page_size} · {t.columns} coluna{t.columns > 1 ? "s" : ""} ·{" "}
                {(t.field_ids ?? []).length} campos
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Remover o modelo "${t.name}"?`)) {
                  deleteMut.mutate(t.id);
                }
              }}
            >
              Remover
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Aba Publicar ----------

function PublishTab({
  formId,
  form,
  onChanged,
}: {
  formId: string;
  form: {
    title: string;
    description: string | null;
    status: string;
    public_slug: string;
  };
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? "");

  const publicUrl = publicFormUrl(window.location.origin, form.public_slug);

  const infoMut = useMutation({
    mutationFn: () => updateFormInfo({ data: { id: formId, title, description } }),
    onSuccess: () => {
      toast.success("Informações salvas.");
      onChanged();
      queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (status: "draft" | "published" | "closed") =>
      setFormStatus({ data: { id: formId, status } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      onChanged();
      queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Card>
        <h3 className="font-semibold text-foreground">Informações</h3>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Descrição (aparece no formulário público)</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Button onClick={() => infoMut.mutate()} disabled={infoMut.isPending}>
              Salvar informações
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-foreground">Link público</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O link só funciona enquanto o formulário estiver publicado.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">
            {publicUrl}
          </code>
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Link copiado.");
            }}
          >
            Copiar link
          </Button>
          {form.status === "published" && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Abrir ↗
            </a>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge color={STATUS_COLOR[form.status] ?? "muted"}>
            {STATUS_LABEL[form.status] ?? form.status}
          </Badge>
          {form.status !== "published" ? (
            <Button variant="secondary" onClick={() => statusMut.mutate("published")}>
              Publicar
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => statusMut.mutate("closed")}>
              Encerrar
            </Button>
          )}
          {form.status === "closed" && (
            <Button variant="ghost" onClick={() => statusMut.mutate("draft")}>
              Voltar para rascunho
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------- Aba Destino ----------

type RuleDraft = {
  label: string;
  send: boolean;
  funnel_id: string;
  stage_id: string;
  conditions: DestinationCondition[];
};

const OPS = Object.keys(CONDITION_OP_LABELS) as ConditionOp[];

function DestinationTab({ formId, schoolId }: { formId: string; schoolId: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["destination", formId],
    queryFn: () => getDestination({ data: { form_id: formId } }),
  });

  const [nameField, setNameField] = useState<string>("");
  const [phoneField, setPhoneField] = useState<string>("");
  const [emailField, setEmailField] = useState<string>("");
  const [extras, setExtras] = useState<{ field_id: string; label: string }[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [defaultSend, setDefaultSend] = useState(true);
  const [defaultFunnel, setDefaultFunnel] = useState<string>("");
  const [defaultStage, setDefaultStage] = useState<string>("");
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (data && !loaded) {
    const d = data.destination;
    setNameField(d?.name_field_id ?? "");
    setPhoneField(d?.phone_field_id ?? "");
    setEmailField(d?.email_field_id ?? "");
    setExtras((d?.extra_fields ?? []).map((e) => ({ field_id: e.field_id, label: e.label ?? "" })));
    setEnabled(d?.enabled ?? true);
    setDefaultSend(d?.default_send ?? true);
    setDefaultFunnel(d?.default_funnel_id ?? "");
    setDefaultStage(d?.default_stage_id ?? "");
    setRules(
      data.rules.map((r) => ({
        label: r.label ?? "",
        send: r.send,
        funnel_id: r.funnel_id ?? "",
        stage_id: r.stage_id ?? "",
        conditions: r.conditions ?? [],
      })),
    );
    setLoaded(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      await saveDestination({
        data: {
          form_id: formId,
          name_field_id: nameField || null,
          phone_field_id: phoneField || null,
          email_field_id: emailField || null,
          extra_fields: extras
            .filter((e) => e.field_id)
            .map((e) => ({ field_id: e.field_id, label: e.label || null })),
          enabled,
          default_send: defaultSend,
          default_funnel_id: defaultFunnel || null,
          default_stage_id: defaultStage || null,
        },
      });
      await saveRules({
        data: {
          form_id: formId,
          rules: rules.map((r) => ({
            label: r.label || null,
            send: r.send,
            funnel_id: r.funnel_id || null,
            stage_id: r.stage_id || null,
            conditions: r.conditions,
          })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Destino salvo.");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const reprocessMut = useMutation({
    mutationFn: () => reprocessSubmissions({ data: { form_id: formId } }),
    onSuccess: (r) =>
      toast.success(
        `${r.total} cadastros revistos: ${r.sent} no CRM, ${r.blocked} bloqueados, ${r.skipped} sem destino.`,
      ),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mt-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const fields = data.fields.filter((f) => !f.internal);
  const funnels = data.funnels.filter((f) => f.school_id === schoolId);
  const stagesOf = (funnelId: string) => data.stages.filter((s) => s.funnel_id === funnelId);

  const moveExtra = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= extras.length) return;
    const next = [...extras];
    const a = next[index]!;
    const b = next[target]!;
    next[index] = b;
    next[target] = a;
    setExtras(next);
  };

  const updateRule = (index: number, patch: Partial<RuleDraft>) =>
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    const a = next[index]!;
    const b = next[target]!;
    next[index] = b;
    next[target] = a;
    setRules(next);
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Envio para o CRM</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {enabled
                ? "Ativado: os cadastros deste formulário seguem as regras abaixo e viram cartões no Pipeline."
                : "Desativado: nenhum cadastro deste formulário será enviado ao CRM."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge color={enabled ? "green" : "muted"}>{enabled ? "Ativado" : "Desativado"}</Badge>
            <Button
              variant={enabled ? "secondary" : "primary"}
              onClick={() => setEnabled((v) => !v)}
            >
              {enabled ? "Desativar envio" : "Ativar envio"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Dados do cartão no CRM</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Escolha de quais respostas saem o nome, o telefone e o e-mail. O título da oportunidade
          será: ID do cadastro · Nome.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Nome", nameField, setNameField],
              ["Telefone", phoneField, setPhoneField],
              ["E-mail", emailField, setEmailField],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label}>
              <Label>{label}</Label>
              <Select value={value} onChange={(e) => setter(e.target.value)}>
                <option value="">Não usar</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Informações adicionais</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Outras respostas que aparecem ao abrir o cartão no Pipeline.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExtras((prev) => [...prev, { field_id: "", label: "" }])}
          >
            Adicionar informação
          </Button>
        </div>

        {extras.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma informação adicional.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {extras.map((extra, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select
                  className="max-w-56"
                  value={extra.field_id}
                  onChange={(e) =>
                    setExtras((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, field_id: e.target.value } : x)),
                    )
                  }
                >
                  <option value="">Campo...</option>
                  {(extra.field_id === SUBMISSION_ID_FIELD ||
                    !extras.some((x) => x.field_id === SUBMISSION_ID_FIELD)) && (
                    <option value={SUBMISSION_ID_FIELD}>ID do cadastro</option>
                  )}
                  {fieldOptionsWithAddressParts(fields)
                    .filter(
                      (o) => o.id === extra.field_id || !extras.some((x) => x.field_id === o.id),
                    )
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                </Select>
                <Input
                  className="max-w-56"
                  value={extra.label}
                  placeholder="Rótulo (opcional)"
                  onChange={(e) =>
                    setExtras((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                />
                <Button type="button" variant="ghost" onClick={() => moveExtra(i, -1)}>
                  ↑
                </Button>
                <Button type="button" variant="ghost" onClick={() => moveExtra(i, 1)}>
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Regras</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Vale a primeira regra cujas condições forem todas atendidas.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setRules((prev) => [
                ...prev,
                { label: "", send: true, funnel_id: "", stage_id: "", conditions: [] },
              ])
            }
          >
            Adicionar regra
          </Button>
        </div>

        {rules.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma regra. Todos os cadastros seguem o destino padrão abaixo.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {rules.map((rule, index) => (
              <div key={index} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 flex-1">
                    <Label>Nome da regra</Label>
                    <Input
                      value={rule.label}
                      placeholder={`Regra ${index + 1}`}
                      onChange={(e) => updateRule(index, { label: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => move(index, -1)}>
                      ↑
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => move(index, 1)}>
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                    >
                      Remover
                    </Button>
                  </div>
                </div>

                <p className="mt-4 text-xs font-medium text-muted-foreground">Condições</p>
                <div className="mt-2 flex flex-col gap-2">
                  {rule.conditions.map((cond, ci) => (
                    <div key={ci} className="flex flex-wrap items-center gap-2">
                      <Select
                        className="max-w-56"
                        value={cond.field_id}
                        onChange={(e) =>
                          updateRule(index, {
                            conditions: rule.conditions.map((c, i) =>
                              i === ci ? { ...c, field_id: e.target.value } : c,
                            ),
                          })
                        }
                      >
                        <option value="">Campo...</option>
                        {fieldOptionsWithAddressParts(fields).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        className="max-w-40"
                        value={cond.op}
                        onChange={(e) =>
                          updateRule(index, {
                            conditions: rule.conditions.map((c, i) =>
                              i === ci ? { ...c, op: e.target.value as ConditionOp } : c,
                            ),
                          })
                        }
                      >
                        {OPS.map((op) => (
                          <option key={op} value={op}>
                            {CONDITION_OP_LABELS[op]}
                          </option>
                        ))}
                      </Select>
                      {cond.op !== "empty" && cond.op !== "not_empty" ? (
                        <Input
                          className="max-w-56"
                          value={cond.value}
                          placeholder={cond.op === "in" ? "Opções separadas por vírgula" : "Valor"}
                          onChange={(e) =>
                            updateRule(index, {
                              conditions: rule.conditions.map((c, i) =>
                                i === ci ? { ...c, value: e.target.value } : c,
                              ),
                            })
                          }
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          updateRule(index, {
                            conditions: rule.conditions.filter((_, i) => i !== ci),
                          })
                        }
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        updateRule(index, {
                          conditions: [
                            ...rule.conditions,
                            { field_id: "", op: "eq", value: "" } as DestinationCondition,
                          ],
                        })
                      }
                    >
                      Adicionar condição
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div>
                    <Label>Ação</Label>
                    <Select
                      value={rule.send ? "sim" : "nao"}
                      onChange={(e) => updateRule(index, { send: e.target.value === "sim" })}
                    >
                      <option value="sim">Enviar ao CRM</option>
                      <option value="nao">Não enviar</option>
                    </Select>
                  </div>
                  {rule.send ? (
                    <>
                      <div className="min-w-44 flex-1">
                        <Label>Funil</Label>
                        <Select
                          value={rule.funnel_id}
                          onChange={(e) =>
                            updateRule(index, { funnel_id: e.target.value, stage_id: "" })
                          }
                        >
                          <option value="">Selecione...</option>
                          {funnels.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="min-w-44 flex-1">
                        <Label>Etapa</Label>
                        <Select
                          value={rule.stage_id}
                          onChange={(e) => updateRule(index, { stage_id: e.target.value })}
                        >
                          <option value="">Selecione...</option>
                          {stagesOf(rule.funnel_id).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Destino padrão</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Usado quando nenhuma regra acima for atendida.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label>Ação</Label>
            <Select
              value={defaultSend ? "sim" : "nao"}
              onChange={(e) => setDefaultSend(e.target.value === "sim")}
            >
              <option value="sim">Enviar ao CRM</option>
              <option value="nao">Não enviar</option>
            </Select>
          </div>
          {defaultSend ? (
            <>
              <div className="min-w-44 flex-1">
                <Label>Funil</Label>
                <Select
                  value={defaultFunnel}
                  onChange={(e) => {
                    setDefaultFunnel(e.target.value);
                    setDefaultStage("");
                  }}
                >
                  <option value="">Selecione...</option>
                  {funnels.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-44 flex-1">
                <Label>Etapa</Label>
                <Select value={defaultStage} onChange={(e) => setDefaultStage(e.target.value)}>
                  <option value="">Selecione...</option>
                  {stagesOf(defaultFunnel).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : null}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          Salvar destino
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (window.confirm("Aplicar as regras aos cadastros já existentes deste formulário?")) {
              reprocessMut.mutate();
            }
          }}
          disabled={reprocessMut.isPending}
        >
          Aplicar aos cadastros existentes
        </Button>
      </div>
    </div>
  );
}

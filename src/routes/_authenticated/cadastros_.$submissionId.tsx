import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteSubmission,
  getMyPermissions,
  getSubmission,
  updateSubmission,
} from "@/lib/ext/cadastros.functions";
import { listPrintTemplates } from "@/lib/ext/impressao.functions";
import {
  ADDRESS_PART_LABELS,
  ADDRESS_PARTS,
  isChildrenCountField,
  parseAddress,
  type FormField,
} from "@/lib/ext/model";
import { FieldRenderer, formatValue } from "@/components/FieldRenderer";

// Endereço exibido em partes, uma por linha (CEP, Rua, Número...).
function AddressPartsLines({ raw }: { raw: string }) {
  const addr = parseAddress(raw);
  const filled = ADDRESS_PARTS.filter((p) => addr[p].trim() !== "");
  if (filled.length === 0) return <span>—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {filled.map((p) => (
        <span key={p}>
          <span className="text-muted-foreground">{ADDRESS_PART_LABELS[p]}:</span> {addr[p]}
        </span>
      ))}
    </span>
  );
}
import { Button, Card, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/cadastros_/$submissionId")({
  head: () => ({
    meta: [
      { title: "Detalhes do cadastro — Grupo Inter" },
      { name: "description", content: "Consulte e edite os dados deste cadastro escolar." },
      { property: "og:title", content: "Detalhes do cadastro — Grupo Inter" },
      { property: "og:description", content: "Consulte e edite os dados deste cadastro escolar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubmissionDetailPage,
});

function SubmissionDetailPage() {
  const { submissionId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => getSubmission({ data: { id: submissionId } }),
  });
  const { data: perms } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => getMyPermissions(),
  });

  const formId = data?.submission.form_id as string | undefined;
  const { data: templates } = useQuery({
    queryKey: ["print-templates", formId],
    queryFn: () => listPrintTemplates({ data: { form_id: formId! } }),
    enabled: !!formId,
  });

  const [editMode, setEditMode] = useState(false);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [printTemplateId, setPrintTemplateId] = useState("");

  const fields = (data?.fields ?? []) as FormField[];
  // O campo automático de quantidade de crianças não é editável à mão.
  const editableFields = fields.filter((f) => !isChildrenCountField(f));

  useEffect(() => {
    if (!data) return;
    const map: Record<string, string | string[]> = {};
    for (const v of data.values) {
      map[v.field_id] = v.value ?? "";
    }
    setValues(map);
  }, [data]);

  const updateMut = useMutation({
    mutationFn: () => updateSubmission({ data: { id: submissionId, values } }),
    onSuccess: (r) => {
      toast.success(r.changed > 0 ? "Cadastro atualizado." : "Nada foi alterado.");
      setEditMode(false);
      queryClient.invalidateQueries({
        queryKey: ["submission", submissionId],
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSubmission({ data: { id: submissionId } }),
    onSuccess: () => {
      toast.success("Cadastro excluído.");
      navigate({ to: "/cadastros" });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="mt-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const { submission, history } = data;
  const school = submission.schools as unknown as { name: string } | null;
  const form = submission.forms as unknown as { title: string } | null;

  const valueMap = new Map(data.values.map((v) => [v.field_id, v.value ?? ""]));

  const canEdit = (perms?.isAdmin || perms?.managerSchools.includes(submission.school_id)) ?? false;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/cadastros" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar para cadastros
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-foreground">{submission.public_id}</h1>
        <span className="text-sm text-muted-foreground">
          {form?.title ?? ""} · {school?.name ?? ""} · criado em{" "}
          {new Date(submission.created_at).toLocaleDateString("pt-BR")}
        </span>
      </div>

      {(() => {
        const status = (submission as { crm_status?: string }).crm_status ?? "none";
        const reason = (submission as { crm_reason?: string | null }).crm_reason ?? null;
        const label =
          status === "sent"
            ? "Enviado ao CRM"
            : status === "blocked"
              ? "Não enviado ao CRM"
              : "Fora do CRM";
        return (
          <p className="mt-2 text-xs text-muted-foreground">
            {label}
            {reason ? ` · ${reason}` : ""}
          </p>
        );
      })()}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canEdit && !editMode && (
          <Button variant="secondary" onClick={() => setEditMode(true)}>
            Editar dados
          </Button>
        )}
        {(templates ?? []).length > 0 && (
          <>
            <Select
              value={printTemplateId}
              onChange={(e) => setPrintTemplateId(e.target.value)}
              className="w-56"
            >
              <option value="">Modelo de impressão...</option>
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              disabled={!printTemplateId}
              onClick={() =>
                navigate({
                  to: "/imprimir/$templateId",
                  params: { templateId: printTemplateId },
                  search: { ids: submissionId },
                })
              }
            >
              Imprimir
            </Button>
          </>
        )}
        {perms?.isAdmin && (
          <Button
            variant="ghost"
            onClick={() => {
              if (
                window.confirm(
                  `Excluir o cadastro ${submission.public_id}? Essa ação não pode ser desfeita.`,
                )
              ) {
                deleteMut.mutate();
              }
            }}
          >
            Excluir
          </Button>
        )}
      </div>

      <Card className="mt-6">
        {editMode ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              updateMut.mutate();
            }}
          >
            {editableFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={
                  values[field.id] ??
                  (field.type === "multiple_choice"
                    ? (() => {
                        try {
                          return JSON.parse(valueMap.get(field.id) ?? "[]");
                        } catch {
                          return [];
                        }
                      })()
                    : "")
                }
                onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
              />
            ))}
            <div className="flex gap-2">
              <Button type="submit" disabled={updateMut.isPending}>
                Salvar alterações
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditMode(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.id}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                  {field.internal && " (interno)"}
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                  {field.type === "address" ? (
                    <AddressPartsLines raw={valueMap.get(field.id) ?? ""} />
                  ) : (
                    formatValue(field, valueMap.get(field.id) ?? "")
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-foreground">Histórico de alterações</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {history.map((h) => {
              const changes = (h.changes ?? []) as {
                label: string;
                before: string;
                after: string;
              }[];
              return (
                <li key={h.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("pt-BR")} · {h.actor_email ?? "sistema"}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {changes.map((c, i) => (
                      <li key={i}>
                        <span className="font-medium">{c.label}:</span>{" "}
                        <span className="text-muted-foreground line-through">
                          {c.before || "—"}
                        </span>{" "}
                        → <span className="text-foreground">{c.after || "—"}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Settings, Trash2 } from "lucide-react";
import { createForm, deleteForm, duplicateForm, listForms } from "@/lib/ext/formularios.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { publicFormUrl } from "@/lib/publicFormUrl";
import { Badge, Button, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";

const ICON_BTN =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";

export const Route = createFileRoute("/_authenticated/formularios")({
  head: () => ({
    meta: [
      { title: "Formulários — Grupo Inter" },
      { name: "description", content: "Crie e publique formulários escolares personalizados." },
      { property: "og:title", content: "Formulários — Grupo Inter" },
      {
        property: "og:description",
        content: "Crie e publique formulários escolares personalizados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormsPage,
});

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

function FormsPage() {
  const queryClient = useQueryClient();
  const { data: forms, isLoading } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: () => listForms(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });

  const [title, setTitle] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [listType, setListType] = useState<"visitantes" | "leads">("visitantes");
  const [dup, setDup] = useState<{ id: string; title: string; schoolId: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-forms"] });

  const createMut = useMutation({
    mutationFn: () => createForm({ data: { title, school_id: schoolId, list_type: listType } }),
    onSuccess: () => {
      toast.success("Formulário criado. Agora adicione os campos.");
      setTitle("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteForm({ data: { id } }),
    onSuccess: () => {
      toast.success("Formulário excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const dupMut = useMutation({
    mutationFn: () =>
      duplicateForm({
        data: {
          id: dup!.id,
          title: dup!.title,
          school_id: dup!.schoolId,
        },
      }),
    onSuccess: () => {
      toast.success("Formulário duplicado como rascunho.");
      setDup(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Formulários</h1>

      <Card className="mt-6">
        <h2 className="font-semibold text-foreground">Novo formulário</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!schoolId) {
              toast.error("Selecione a escola.");
              return;
            }
            createMut.mutate();
          }}
        >
          <div className="min-w-48 flex-1">
            <Label htmlFor="form-title">Título</Label>
            <Input
              id="form-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Matrícula 2026"
              required
            />
          </div>
          <div className="min-w-48 flex-1">
            <Label htmlFor="form-school">Escola</Label>
            <Select id="form-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">Selecione...</option>
              {(schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-48 flex-1">
            <Label htmlFor="form-list">Enviar para</Label>
            <Select
              id="form-list"
              value={listType}
              onChange={(e) => setListType(e.target.value as "visitantes" | "leads")}
            >
              <option value="visitantes">Lista de Visitantes</option>
              <option value="leads">Lista de LEADS</option>
            </Select>
          </div>
          <Button type="submit" disabled={createMut.isPending}>
            Criar
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !forms || forms.length === 0 ? (
        <EmptyState
          title="Nenhum formulário criado"
          description="Crie o primeiro formulário acima."
        />
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {forms.map((f) => {
            const school = f.schools as unknown as { name: string } | null;
            const destRaw = f.form_destinations as unknown as
              { enabled: boolean } | { enabled: boolean }[] | null;
            const destRow = Array.isArray(destRaw) ? (destRaw[0] ?? null) : destRaw;
            const destEnabled = destRow ? destRow.enabled : null;
            return (
              <Card key={f.id} className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{f.title}</p>
                    <Badge color={STATUS_COLOR[f.status] ?? "muted"}>
                      {STATUS_LABEL[f.status] ?? f.status}
                    </Badge>
                    {destEnabled === null ? (
                      <Badge color="muted">Sem destino</Badge>
                    ) : destEnabled ? (
                      <Badge color="green">Envio ativado</Badge>
                    ) : (
                      <Badge color="muted">Envio desativado</Badge>
                    )}
                    <Badge color="muted">
                      {(f as { list_type?: string }).list_type === "leads"
                        ? "Lista de LEADS"
                        : "Lista de Visitantes"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{school?.name ?? "—"}</p>
                </div>
                {f.status === "published" ? (
                  <button
                    type="button"
                    className={ICON_BTN}
                    title="Copiar link do formulário"
                    aria-label="Copiar link do formulário"
                    onClick={async () => {
                      const url = publicFormUrl(window.location.origin, f.public_slug);
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Link copiado.");
                      } catch {
                        toast.error("Não foi possível copiar o link.");
                      }
                    }}
                  >
                    <Link2 size={18} />
                  </button>
                ) : null}
                <Link
                  to="/formularios/$formId"
                  params={{ formId: f.id }}
                  className={ICON_BTN}
                  title="Configurar"
                  aria-label="Configurar"
                >
                  <Settings size={18} />
                </Link>
                <button
                  type="button"
                  className={ICON_BTN}
                  title="Duplicar"
                  aria-label="Duplicar"
                  onClick={() =>
                    setDup({
                      id: f.id,
                      title: `Cópia de ${f.title}`,
                      schoolId: f.school_id,
                    })
                  }
                >
                  <Copy size={18} />
                </button>
                <button
                  type="button"
                  className={ICON_BTN}
                  title="Excluir"
                  aria-label="Excluir"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Excluir o formulário "${f.title}"? Todos os cadastros dele serão removidos.`,
                      )
                    ) {
                      deleteMut.mutate(f.id);
                    }
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {dup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <Card className="w-full max-w-md">
            <h2 className="font-semibold text-foreground">Duplicar formulário</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Os campos e modelos de impressão serão copiados. Os cadastros não.
            </p>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!dup.schoolId) {
                  toast.error("Selecione a escola.");
                  return;
                }
                dupMut.mutate();
              }}
            >
              <div>
                <Label htmlFor="dup-title">Novo título</Label>
                <Input
                  id="dup-title"
                  value={dup.title}
                  onChange={(e) => setDup({ ...dup, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dup-school">Escola</Label>
                <Select
                  id="dup-school"
                  value={dup.schoolId}
                  onChange={(e) => setDup({ ...dup, schoolId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {(schools ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDup(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={dupMut.isPending}>
                  Duplicar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

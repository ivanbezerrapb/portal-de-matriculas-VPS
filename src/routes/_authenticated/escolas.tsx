import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createSchool, deleteSchool, listSchools, updateSchool } from "@/lib/ext/escolas.functions";
import type { School } from "@/lib/ext/model";
import { Button, Card, EmptyState, Input, Label, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/escolas")({
  head: () => ({
    meta: [
      { title: "Escolas — Grupo Inter" },
      { name: "description", content: "Gerencie escolas e sequências de identificação." },
      { property: "og:title", content: "Escolas — Grupo Inter" },
      { property: "og:description", content: "Gerencie escolas e sequências de identificação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchoolsPage,
});

const emptyForm = { name: "", id_prefix: "", id_digits: 4, id_next_number: 1 };

function EditSchoolCard({
  school,
  saving,
  onSave,
  onCancel,
}: {
  school: School;
  saving: boolean;
  onSave: (s: School) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<School>(school);
  return (
    <Card>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <div className="min-w-48 flex-1">
          <Label>Nome</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
        </div>
        <div className="w-28">
          <Label>Prefixo</Label>
          <Input
            value={draft.id_prefix}
            onChange={(e) => setDraft({ ...draft, id_prefix: e.target.value.toUpperCase() })}
            required
          />
        </div>
        <div className="w-24">
          <Label>Dígitos</Label>
          <Input
            type="number"
            min={2}
            max={8}
            value={draft.id_digits}
            onChange={(e) => setDraft({ ...draft, id_digits: Number(e.target.value) })}
            required
          />
        </div>
        <div className="w-32">
          <Label>Próximo número</Label>
          <Input
            type="number"
            min={1}
            value={draft.id_next_number}
            onChange={(e) => setDraft({ ...draft, id_next_number: Number(e.target.value) })}
            required
          />
        </div>
        <Button type="submit" disabled={saving}>
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Atenção: reduzir o próximo número pode gerar IDs duplicados.
      </p>
    </Card>
  );
}

function SchoolsPage() {
  const queryClient = useQueryClient();
  const { data: schools, isLoading } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["schools"] });

  const createMut = useMutation({
    mutationFn: () => createSchool({ data: form }),
    onSuccess: () => {
      toast.success("Escola criada.");
      setForm(emptyForm);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (s: School) =>
      updateSchool({
        data: {
          id: s.id,
          name: s.name,
          logo_url: s.logo_url,
          id_prefix: s.id_prefix,
          id_digits: s.id_digits,
          id_next_number: s.id_next_number,
        },
      }),
    onSuccess: () => {
      toast.success("Escola atualizada.");
      setEditingId(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSchool({ data: { id } }),
    onSuccess: () => {
      toast.success("Escola excluída.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Escolas</h1>

      <Card className="mt-6">
        <h2 className="font-semibold text-foreground">Nova escola</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <div className="min-w-48 flex-1">
            <Label htmlFor="school-name">Nome</Label>
            <Input
              id="school-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: E.M. Monteiro Lobato"
              required
            />
          </div>
          <div className="w-32">
            <Label htmlFor="school-prefix">Prefixo do ID</Label>
            <Input
              id="school-prefix"
              value={form.id_prefix}
              onChange={(e) => setForm({ ...form, id_prefix: e.target.value.toUpperCase() })}
              placeholder="ESCA"
              maxLength={10}
              required
            />
          </div>
          <div className="w-28">
            <Label htmlFor="school-digits">Dígitos</Label>
            <Input
              id="school-digits"
              type="number"
              min={2}
              max={8}
              value={form.id_digits}
              onChange={(e) => setForm({ ...form, id_digits: Number(e.target.value) })}
              required
            />
          </div>
          <Button type="submit" disabled={createMut.isPending}>
            Criar
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Exemplo de ID:{" "}
          <span className="font-mono">
            {"1".padStart(form.id_digits, "0") + "/" + (form.id_prefix || "ESCA")}
          </span>
        </p>
      </Card>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : !schools || schools.length === 0 ? (
        <EmptyState title="Nenhuma escola cadastrada" description="Crie a primeira escola acima." />
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {schools.map((s) =>
            editingId === s.id ? (
              <EditSchoolCard
                key={s.id}
                school={s}
                saving={updateMut.isPending}
                onSave={(draft) => updateMut.mutate(draft)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={s.id} className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Prefixo <span className="font-mono">{s.id_prefix}</span> · próximo ID:{" "}
                    <span className="font-mono">
                      {String(s.id_next_number).padStart(s.id_digits, "0")}/{s.id_prefix}
                    </span>
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setEditingId(s.id)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Excluir a escola "${s.name}"? Os cadastros vinculados também serão removidos.`,
                      )
                    ) {
                      deleteMut.mutate(s.id);
                    }
                  }}
                >
                  Excluir
                </Button>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}

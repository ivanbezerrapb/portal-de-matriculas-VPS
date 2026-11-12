import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, ExternalLink, Link2, Trash2, Upload } from "lucide-react";
import { Button, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";
import { getSupabase } from "@/lib/ext/browser";
import {
  BRAND_LABELS,
  FILE_BUCKET,
  createFileCategory,
  createFileRecord,
  createLinkRecord,
  deleteFile,
  getDownloadUrl,
  getFileAccess,
  listFileCategories,
  listFiles,
  type Brand,
} from "@/lib/ext/arquivos.functions";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .slice(-80);
}

export function CentralArquivos({ brand }: { brand: Brand }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [target, setTarget] = useState<string>("brand");
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCategory, setNewCategory] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: access } = useQuery({
    queryKey: ["file-access"],
    queryFn: () => getFileAccess(),
    staleTime: 60_000,
  });

  const { data: categories } = useQuery({
    queryKey: ["file-categories", brand],
    queryFn: () => listFileCategories({ data: { brand } }),
    staleTime: 30_000,
  });

  const { data: files, isLoading } = useQuery({
    queryKey: ["shared-files", brand, filterCategory],
    queryFn: () =>
      listFiles({
        data: { brand, ...(filterCategory ? { category_id: filterCategory } : {}) },
      }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const canManage = access?.manageBrands.includes(brand) ?? false;
  const brandSchools = useMemo(
    () => (access?.schools ?? []).filter((s) => s.brand === brand),
    [access, brand],
  );

  const removeM = useMutation({
    mutationFn: (id: string) => deleteFile({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shared-files"] }),
    onError: (err: Error) => setError(err.message),
  });

  async function handleDownload(id: string) {
    try {
      const { url } = await getDownloadUrl({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      let finalCategory = categoryId || null;
      if (newCategory.trim().length >= 2) {
        const created = await createFileCategory({
          data: { brand, name: newCategory.trim() },
        });
        finalCategory = created.id;
        await queryClient.invalidateQueries({ queryKey: ["file-categories", brand] });
      }

      const supabase = await getSupabase();
      const schoolId = target === "brand" ? null : target;
      const folder = schoolId ?? "marca";

      for (const file of Array.from(fileList)) {
        const path = `${brand}/${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
        const { error: upErr } = await supabase.storage.from(FILE_BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (upErr) throw new Error(upErr.message);
        await createFileRecord({
          data: {
            brand,
            school_id: schoolId,
            category_id: finalCategory,
            name: file.name,
            path,
            mime_type: file.type || null,
            size_bytes: file.size,
          },
        });
      }

      setNewCategory("");
      if (fileInput.current) fileInput.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAddLink() {
    setError(null);
    const name = linkName.trim();
    let url = linkUrl.trim();
    if (name.length < 1) {
      setError("Informe um título para o link.");
      return;
    }
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (!/^https?:\/\/.+\..+/i.test(url)) {
      setError("Informe um endereço válido, por exemplo https://exemplo.com/pasta");
      return;
    }
    setSavingLink(true);
    try {
      let finalCategory = categoryId || null;
      if (newCategory.trim().length >= 2) {
        const created = await createFileCategory({
          data: { brand, name: newCategory.trim() },
        });
        finalCategory = created.id;
        await queryClient.invalidateQueries({ queryKey: ["file-categories", brand] });
      }
      await createLinkRecord({
        data: {
          brand,
          school_id: target === "brand" ? null : target,
          category_id: finalCategory,
          name,
          url,
        },
      });
      setLinkName("");
      setLinkUrl("");
      setNewCategory("");
      await queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingLink(false);
    }
  }

  async function handleCopy(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      setError("Não foi possível copiar o endereço.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Central de Arquivos · {BRAND_LABELS[brand]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {brandSchools.map((s) => s.name).join(" · ") || "Sem unidades vinculadas"}
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Label htmlFor="filtro-categoria">Categoria</Label>
          <Select
            id="filtro-categoria"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Todas</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {canManage && (
        <Card>
          <h2 className="font-display text-base font-semibold text-foreground">
            Enviar arquivos ou links
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="destino">Destino</Label>
              <Select id="destino" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="brand">Toda a marca {BRAND_LABELS[brand]}</option>
                {brandSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                id="categoria"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Sem categoria</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="nova-categoria">Nova categoria</Label>
              <Input
                id="nova-categoria"
                placeholder="Ex.: Comunicados"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files)}
              />
              <Button
                className="w-full"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Enviando..." : "Escolher arquivos"}
              </Button>
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Adicionar link de acesso</p>
            <p className="text-xs text-muted-foreground">
              Usa o mesmo destino e categoria escolhidos acima.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="link-titulo">Título</Label>
                <Input
                  id="link-titulo"
                  placeholder="Ex.: Pasta de materiais"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                />
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor="link-url">Endereço (URL)</Label>
                <Input
                  id="link-url"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={savingLink}
                  onClick={() => void handleAddLink()}
                >
                  {savingLink ? <Spinner className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {savingLink ? "Salvando..." : "Adicionar link"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (files ?? []).length === 0 ? (
        <EmptyState
          title="Nada por aqui ainda"
          description={
            canManage
              ? "Envie o primeiro arquivo ou link para a equipe."
              : "Assim que a gestão enviar arquivos ou links, eles aparecem aqui."
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-4 py-3">Enviado por</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(files ?? []).map((f) => (
                <tr key={f.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.kind === "link" ? "Link" : "Arquivo"}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {f.name}
                    {f.kind === "link" && f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block max-w-[320px] truncate text-xs font-normal text-primary underline underline-offset-2"
                        title={f.url}
                      >
                        {f.url}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.file_categories?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.schools?.name ?? BRAND_LABELS[brand]}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.kind === "link" ? "—" : formatSize(f.size_bytes)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{f.uploaded_by_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(f.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {f.kind === "link" && f.url ? (
                        <>
                          <Button
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            title={copiedId === f.id ? "Copiado!" : "Copiar endereço"}
                            aria-label={`Copiar endereço de ${f.name}`}
                            onClick={() => void handleCopy(f.id, f.url as string)}
                          >
                            <Copy
                              className={`h-4 w-4 ${copiedId === f.id ? "text-primary" : ""}`}
                            />
                          </Button>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir link"
                            aria-label={`Abrir ${f.name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          className="h-9 w-9 p-0"
                          title="Baixar"
                          aria-label={`Baixar ${f.name}`}
                          onClick={() => void handleDownload(f.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          className="h-9 w-9 p-0 text-destructive"
                          title="Excluir"
                          aria-label={`Excluir ${f.name}`}
                          disabled={removeM.isPending}
                          onClick={() => {
                            if (confirm(`Excluir "${f.name}"?`)) removeM.mutate(f.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

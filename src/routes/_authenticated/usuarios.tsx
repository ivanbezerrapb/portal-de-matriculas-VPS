import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Lock, Pencil, Plus, Trash2 } from "lucide-react";

const ACT = "inline-flex h-7 items-center gap-1.5 px-2 py-0 text-xs";
import {
  createUser,
  deleteUser,
  listUsers,
  setUserFunnels,
  setUserRole,
  setMustChangePassword,
  resetUserPassword,
  updateUser,
} from "@/lib/ext/usuarios.functions";
import { getMaxbotUserLinks, saveMaxbotUserLink } from "@/lib/ext/maxbot.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { listFunnels } from "@/lib/ext/funis.functions";
import { ROLE_LABELS } from "@/lib/ext/model";
import { Badge, Button, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Grupo Inter" },
      { name: "description", content: "Gerencie usuários e permissões por escola." },
      { property: "og:title", content: "Usuários — Grupo Inter" },
      { property: "og:description", content: "Gerencie usuários e permissões por escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

type Role = "admin" | "school_manager" | "print_operator" | "info_center" | "direcao";
const ROLES = Object.entries(ROLE_LABELS) as [Role, string][];
const NEEDS_SCHOOL: Role[] = ["school_manager", "print_operator", "info_center"];

function UsersPage() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });
  const { data: funnelsData } = useQuery({
    queryKey: ["funnels"],
    queryFn: () => listFunnels(),
  });
  const funnels = funnelsData?.funnels ?? [];
  const { data: maxbot } = useQuery({
    queryKey: ["maxbot-user-links"],
    queryFn: () => getMaxbotUserLinks(),
    staleTime: 60_000,
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("print_operator");
  const [schoolId, setSchoolId] = useState("");
  const [addRoleFor, setAddRoleFor] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<Role>("print_operator");
  const [newRoleSchool, setNewRoleSchool] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "all">("all");
  const [filterSchool, setFilterSchool] = useState("all");
  const [funnelIds, setFunnelIds] = useState<string[]>([]);
  const [editFunnelsFor, setEditFunnelsFor] = useState<string | null>(null);
  const [editFunnelIds, setEditFunnelIds] = useState<string[]>([]);

  const [mustChange, setMustChange] = useState(true);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetMust, setResetMust] = useState(true);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMut = useMutation({
    mutationFn: () =>
      createUser({
        data: {
          email,
          password,
          full_name: fullName,
          role,
          ...(NEEDS_SCHOOL.includes(role) && schoolId ? { school_id: schoolId } : {}),
          ...(role === "info_center" ? { funnel_ids: funnelIds } : {}),
          must_change_password: mustChange,
        },
      }),
    onSuccess: () => {
      toast.success("Usuário criado.");
      setEmail("");
      setPassword("");
      setFullName("");
      setFunnelIds([]);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (vars: {
      user_id: string;
      role: Role;
      school_id: string | null;
      action: "add" | "remove";
    }) => setUserRole({ data: vars }),
    onSuccess: () => {
      toast.success("Permissões atualizadas.");
      setAddRoleFor(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const funnelsMut = useMutation({
    mutationFn: (vars: { user_id: string; funnel_ids: string[] }) => setUserFunnels({ data: vars }),
    onSuccess: () => {
      toast.success("Funis atualizados.");
      setEditFunnelsFor(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const mustMut = useMutation({
    mutationFn: (vars: { user_id: string; value: boolean }) => setMustChangePassword({ data: vars }),
    onSuccess: () => {
      toast.success("Atualizado.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [editFor, setEditFor] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const editMut = useMutation({
    mutationFn: (vars: { user_id: string; full_name: string; email: string }) =>
      updateUser({ data: vars }),
    onSuccess: () => {
      toast.success("Usuário atualizado.");
      setEditFor(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (vars: { user_id: string; password: string; must_change_password: boolean }) =>
      resetUserPassword({ data: vars }),
    onSuccess: () => {
      toast.success("Senha redefinida.");
      setResetFor(null);
      setResetPw("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Usuário excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const schoolName = (id: string | null) => schools?.find((s) => s.id === id)?.name ?? "";

  const funnelName = (id: string) => funnels.find((f) => f.id === id)?.name ?? "Funil removido";
  const funnelsForSchool = (school: string) =>
    school ? funnels.filter((f) => f.school_id === school) : funnels;

  const normalize = (v: string) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const filteredUsers = useMemo(() => {
    const q = normalize(filterName.trim());
    return (users ?? []).filter((u) => {
      if (q && !normalize(`${u.full_name} ${u.email}`).includes(q)) return false;
      if (filterRole !== "all" && !u.roles.some((r) => r.role === filterRole)) return false;
      // Direção enxerga todas as escolas, então nunca é filtrada por unidade.
      const isDirecao = u.roles.some((r) => r.role === "direcao");
      if (
        filterSchool !== "all" &&
        !isDirecao &&
        !u.roles.some((r) => r.school_id === filterSchool)
      )
        return false;
      return true;
    });
  }, [users, filterName, filterRole, filterSchool]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Usuários</h1>

      <Card className="mt-6">
        <h2 className="font-semibold text-foreground">Novo usuário</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (NEEDS_SCHOOL.includes(role) && !schoolId) {
              toast.error("Selecione a escola para este perfil.");
              return;
            }
            if (role === "info_center" && funnelIds.length === 0) {
              toast.error("Selecione ao menos um funil para a Central de Informações.");
              return;
            }
            createMut.mutate();
          }}
        >
          <div>
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Senha inicial</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={mustChange}
                onChange={(e) => setMustChange(e.target.checked)}
              />
              Exigir troca de senha no próximo acesso
            </label>
          </div>
          <div>
            <Label>Perfil</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {NEEDS_SCHOOL.includes(role) && (
            <div>
              <Label>Escola</Label>
              <Select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">Selecione...</option>
                {(schools ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {role === "info_center" && (
            <div className="sm:col-span-2">
              <Label>Funis que este usuário irá atender</Label>
              <div className="mt-1 flex flex-wrap gap-3 rounded-md border border-border p-3">
                {funnelsForSchool(schoolId).length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Selecione a escola para ver os funis.
                  </span>
                ) : (
                  funnelsForSchool(schoolId).map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={funnelIds.includes(f.id)}
                        onChange={(e) =>
                          setFunnelIds((prev) =>
                            e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id),
                          )
                        }
                      />
                      {f.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
          <div className="flex items-end">
            <Button type="submit" disabled={createMut.isPending}>
              Criar usuário
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Nome</Label>
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
            />
          </div>
          <div>
            <Label>Perfil</Label>
            <Select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as Role | "all")}
            >
              <option value="all">Todos os perfis</option>
              {ROLES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Escola</Label>
            <Select value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
              <option value="all">Todas as escolas</option>
              {(schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
      ) : filteredUsers.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nenhum usuário encontrado"
            description="Ajuste os filtros para ver outros usuários."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {filteredUsers.map((u) => (
            <Card key={u.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 [&>*]:col-start-1">
              <div className="min-w-0">
                  <p className="font-medium text-foreground">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {u.must_change_password && (
                    <span className="mt-1 inline-block">
                      <Badge color="amber">Troca de senha pendente</Badge>
                    </span>
                  )}
              </div>
              <div className="!col-start-2 row-span-4 row-start-1 flex flex-col items-end gap-0.5">
                <Button
                  variant="ghost"
                  className={ACT}
                  onClick={() => {
                    setEditFor(editFor === u.id ? null : u.id);
                    setEditName(u.full_name ?? "");
                    setEditEmail(u.email ?? "");
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  className={ACT}
                  onClick={() => mustMut.mutate({ user_id: u.id, value: !u.must_change_password })}
                >
                  <Lock className="h-3.5 w-3.5" /> {u.must_change_password ? "Cancelar exigência" : "Exigir troca de senha"}
                </Button>
                <Button
                  variant="ghost"
                  className={ACT}
                  onClick={() => {
                    setResetFor(resetFor === u.id ? null : u.id);
                    setResetPw("");
                    setResetMust(true);
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Redefinir senha
                </Button>
                <Button
                  variant="ghost"
                  className={ACT}
                  onClick={() => setAddRoleFor(addRoleFor === u.id ? null : u.id)}
                >
                  <Plus className="h-3.5 w-3.5" /> Perfil
                </Button>
                <Button
                  variant="ghost"
                  className={`${ACT} text-destructive`}
                  onClick={() => {
                    if (window.confirm(`Excluir o usuário ${u.email}?`)) {
                      deleteMut.mutate(u.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              </div>
              {editFor === u.id && (
                <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <div>
                    <Label>Nome</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEditFor(null)}>Cancelar</Button>
                    <Button
                      disabled={editMut.isPending || !editName.trim() || !editEmail.trim()}
                      onClick={() =>
                        editMut.mutate({ user_id: u.id, full_name: editName.trim(), email: editEmail.trim() })
                      }
                    >
                      Salvar
                    </Button>
                  </div>
                  {maxbot && <MaxbotLinkEditor userId={u.id} data={maxbot} />}
                </div>
              )}

              {maxbot && (["conecta", "interactivo"] as const).some((a) => maxbot[a].links[u.id]) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["conecta", "interactivo"] as const).map((a) =>
                    maxbot[a].links[u.id] ? (
                      <Badge key={a} color="green">
                        Maxbot {a === "conecta" ? "Conecta" : "Interactivo"} · {maxbot[a].links[u.id]!.name}
                      </Badge>
                    ) : null,
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {u.roles.length === 0 && (
                  <span className="text-sm text-muted-foreground">Sem perfil atribuído</span>
                )}
                {u.roles.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-2">
                    <Badge color="muted">
                      {ROLE_LABELS[r.role] ?? r.role}
                      {r.school_id ? ` · ${schoolName(r.school_id)}` : ""}
                    </Badge>
                    <button
                      className="text-xs text-destructive hover:underline"
                      onClick={() =>
                        roleMut.mutate({
                          user_id: u.id,
                          role: r.role as Role,
                          school_id: r.school_id,
                          action: "remove",
                        })
                      }
                    >
                      remover
                    </button>
                  </span>
                ))}
              </div>

              {u.roles.some((r) => r.role === "info_center") && (
                <div className="mt-3 rounded-md bg-muted p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">Funis atendidos:</span>
                    <span className="text-sm text-muted-foreground">
                      {u.funnel_ids.length === 0
                        ? "Nenhum funil atribuído"
                        : u.funnel_ids.map((id) => funnelName(id)).join(", ")}
                    </span>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        setEditFunnelsFor(editFunnelsFor === u.id ? null : u.id);
                        setEditFunnelIds(u.funnel_ids);
                      }}
                    >
                      {editFunnelsFor === u.id ? "cancelar" : "alterar"}
                    </button>
                  </div>
                  {editFunnelsFor === u.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {funnels
                        .filter((f) =>
                          u.roles.some(
                            (r) => r.role === "info_center" && r.school_id === f.school_id,
                          ),
                        )
                        .map((f) => (
                          <label key={f.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editFunnelIds.includes(f.id)}
                              onChange={(e) =>
                                setEditFunnelIds((prev) =>
                                  e.target.checked
                                    ? [...prev, f.id]
                                    : prev.filter((id) => id !== f.id),
                                )
                              }
                            />
                            {f.name}
                          </label>
                        ))}
                      <Button
                        variant="secondary"
                        onClick={() =>
                          funnelsMut.mutate({ user_id: u.id, funnel_ids: editFunnelIds })
                        }
                      >
                        Salvar funis
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {resetFor === u.id && (
                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-muted p-3">
                  <div>
                    <Label>Nova senha provisória</Label>
                    <Input
                      type="text"
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                      minLength={6}
                    />
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={resetMust}
                      onChange={(e) => setResetMust(e.target.checked)}
                    />
                    Exigir troca no próximo acesso
                  </label>
                  <Button
                    variant="secondary"
                    disabled={resetMut.isPending}
                    onClick={() => {
                      if (resetPw.length < 6) {
                        toast.error("A senha deve ter pelo menos 6 caracteres.");
                        return;
                      }
                      resetMut.mutate({
                        user_id: u.id,
                        password: resetPw,
                        must_change_password: resetMust,
                      });
                    }}
                  >
                    Salvar senha
                  </Button>
                </div>
              )}

              {addRoleFor === u.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-muted p-3">
                  <div>
                    <Label>Perfil</Label>
                    <Select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                      {ROLES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {NEEDS_SCHOOL.includes(newRole) && (
                    <div>
                      <Label>Escola</Label>
                      <Select
                        value={newRoleSchool}
                        onChange={(e) => setNewRoleSchool(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {(schools ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (NEEDS_SCHOOL.includes(newRole) && !newRoleSchool) {
                        toast.error("Selecione a escola.");
                        return;
                      }
                      roleMut.mutate({
                        user_id: u.id,
                        role: newRole,
                        school_id: NEEDS_SCHOOL.includes(newRole) ? newRoleSchool : null,
                        action: "add",
                      });
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type MaxbotLinks = Awaited<ReturnType<typeof getMaxbotUserLinks>>;
function MaxbotLinkEditor({ userId, data }: { userId: string; data: MaxbotLinks }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState({
    conecta: data.conecta.links[userId]?.id ?? "",
    interactivo: data.interactivo.links[userId]?.id ?? "",
  });
  const mut = useMutation({
    mutationFn: () => {
      const pick = (a: "conecta" | "interactivo") => {
        if (!data[a].token_set) return undefined;
        const at = data[a].attendants.find((x) => x.id === sel[a]);
        return sel[a] && at ? { id: at.id, name: at.name } : null;
      };
      return saveMaxbotUserLink({ data: { userId, conecta: pick("conecta"), interactivo: pick("interactivo") } });
    },
    onSuccess: () => {
      toast.success("Vínculo com o Maxbot salvo.");
      qc.invalidateQueries({ queryKey: ["maxbot-user-links"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const ownerOf = (a: "conecta" | "interactivo", attId: string) =>
    Object.entries(data[a].links).find(([uid, l]) => l.id === attId && uid !== userId);
  return (
    <div className="sm:col-span-3 rounded-md border border-border p-3">
      <p className="mb-2 text-sm font-medium text-foreground">Atendente no Maxbot</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {(["conecta", "interactivo"] as const).map((a) => (
          <div key={a}>
            <Label>{a === "conecta" ? "Maxbot Conecta" : "Maxbot Interactivo"}</Label>
            {!data[a].token_set ? (
              <p className="text-xs text-muted-foreground">Conta sem token configurado.</p>
            ) : data[a].error ? (
              <p className="text-xs text-destructive">{data[a].error}</p>
            ) : (
              <Select value={sel[a]} onChange={(e) => setSel((p) => ({ ...p, [a]: e.target.value }))}>
                <option value="">Não vinculado</option>
                {data[a].attendants.map((at) => {
                  const taken = ownerOf(a, at.id);
                  return (
                    <option key={at.id} value={at.id} disabled={Boolean(taken)}>
                      {at.name} (ID {at.id}){at.active ? "" : " (inativo)"}{taken ? " — já vinculado" : ""}
                    </option>
                  );
                })}
              </Select>
            )}
          </div>
        ))}
        <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
          Salvar vínculo
        </Button>
      </div>
    </div>
  );
}

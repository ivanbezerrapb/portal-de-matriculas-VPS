import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button, Select } from "@/components/ui";
import { listSubmissions, sendSubmissionToFunnel } from "@/lib/ext/cadastros.functions";
import { listFunnelOwners, listFunnels } from "@/lib/ext/funis.functions";
import { funnelListType } from "@/lib/ext/model";


type Row = {
  id: string; public_id: string; school_id: string; created_at?: string;
  responsible_name?: string | null; series?: string[]; restricted?: boolean;
  enrolled?: boolean; funnel?: { funnel_id?: string } | null; schools?: { name?: string } | null;
};

export function usePendingFunnel(enabled: boolean) {
  return useQuery({
    queryKey: ["submissions", "pending-funnel"],
    enabled,
    refetchInterval: 60 * 60 * 1000,
    queryFn: async () => {
      const res = (await listSubmissions({ data: { list_type: "visitantes" } })) as unknown as Row[];
      const rows = Array.isArray(res) ? res : [];
      return rows.filter((r) => !r.funnel?.funnel_id && !r.restricted && !r.enrolled);
    },
  });
}

export function PendingFunnelSection({ enabled }: { enabled: boolean }) {
  const { data: raw, refetch } = usePendingFunnel(enabled);
  const data = Array.isArray(raw) ? raw : [];
  const qc = useQueryClient();
  const [choice, setChoice] = useState<Record<string, { funnel?: string; owner?: string }>>({});
  const { data: funnels = [] } = useQuery({ queryKey: ["funnels"], queryFn: () => listFunnels(), enabled });
  const { data: owners = [] } = useQuery({ queryKey: ["funnel-owners"], queryFn: () => listFunnelOwners(), enabled });


  const send = useMutation({
    mutationFn: (v: { submission_id: string; funnel_id: string; attendant_user_id?: string; attendant_name?: string }) =>
      sendSubmissionToFunnel({ data: v }),
    onSuccess: () => {
      toast.success("Visita associada ao funil.");
      for (const k of ["submissions", "pipeline", "crm-tasks", "dashboard-stats"]) qc.invalidateQueries({ queryKey: [k] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const fd = funnels as unknown as { funnels?: { id: string; name: string; school_id: string }[] } | undefined;
  const list = Array.isArray(fd?.funnels) ? fd!.funnels! : [];
  const ownerList = (Array.isArray(owners) ? owners : []) as { funnel_id: string; user_id: string; name: string }[];

  if (!data.length) return <p className="p-6 text-center text-sm text-muted-foreground">Nada pendente.</p>;
  return (
    <>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {data.map((r) => {
            const opts = list.filter((f) => f.school_id === r.school_id && funnelListType(f.name) === "visitantes");
            const c = choice[r.id] ?? {};
            const fOwners = [...new Map(ownerList.filter((o) => o.funnel_id === c.funnel && o.name?.trim()).map((o) => [o.user_id, o])).values()];
            const owner = fOwners.length === 1 ? fOwners[0] : fOwners.find((o) => o.user_id === c.owner);
            const ready = !!c.funnel && (fOwners.length <= 1 || !!owner);
            return (
              <li key={r.id} className="p-4">
                <p className="font-semibold"><span className="font-mono">{r.public_id}</span> · {r.responsible_name ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.schools?.name}{r.created_at ? ` · ${format(new Date(r.created_at), "dd/MM/yyyy")}` : ""}
                  {r.series?.length ? ` · ${r.series.join(", ")}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select value={c.funnel ?? ""} onChange={(e) => setChoice({ ...choice, [r.id]: { funnel: e.target.value } })} className="w-56">
                    <option value="">Escolha o funil</option>
                    {opts.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                  {fOwners.length > 1 && (
                    <Select value={c.owner ?? ""} onChange={(e) => setChoice({ ...choice, [r.id]: { ...c, owner: e.target.value } })} className="w-48">
                      <option value="">Responsável</option>
                      {fOwners.map((o) => <option key={o.user_id} value={o.user_id}>{o.name}</option>)}
                    </Select>
                  )}
                  <Button
                    disabled={!ready || send.isPending}
                    onClick={() => send.mutate({
                      submission_id: r.id, funnel_id: c.funnel!,
                      ...(owner ? { attendant_user_id: owner.user_id, attendant_name: owner.name.trim() } : {}),
                    })}
                  >
                    Associar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
    </>
  );
}

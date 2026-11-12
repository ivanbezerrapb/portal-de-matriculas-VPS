import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { PendingAttendanceSection, usePendingAttendance } from "@/components/PendingAttendanceDialog";
import { PendingFunnelSection, usePendingFunnel } from "@/components/PendingFunnelDialog";

const SNOOZE_KEY = "pending-tasks-snooze";
const SNOOZE_MS = 60 * 60 * 1000;

export function PendingTasksDialog({ enabled }: { enabled: boolean }) {
  const { data: att = [], refetch: refetchAtt } = usePendingAttendance(enabled);
  const { data: fun, refetch: refetchFun } = usePendingFunnel(enabled);
  const nA = att.length;
  const nF = Array.isArray(fun) ? fun.length : 0;
  const total = nA + nF;
  const [open, setOpen] = useState(false);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!total) { setOpen(false); return; }
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (until > Date.now() + SNOOZE_MS) localStorage.removeItem(SNOOZE_KEY);
    const snoozed = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (!open && Date.now() >= snoozed) {
      if (snoozed) {
        localStorage.removeItem(SNOOZE_KEY);
        Promise.all([refetchAtt(), refetchFun()]).then(([a, f]) => {
          const n = (a.data?.length ?? 0) + (Array.isArray(f.data) ? f.data.length : 0);
          if (n > 0) setOpen(true);
        });
      } else setOpen(true);
    }
  }, [total, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !total) return null;
  const snooze = () => { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); setOpen(false); };
  const head = (label: string, n: number) => (
    <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm font-semibold">
      {label}
      <span className={`rounded-full px-2 text-xs ${n ? "bg-destructive text-destructive-foreground" : "bg-background text-muted-foreground"}`}>{n}</span>
    </h3>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-start gap-3 border-b border-border p-4">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[oklch(0.72_0.18_60)]" />
          <div>
            <h2 className="text-lg font-semibold">Pendências ({total})</h2>
            <p className="text-sm text-muted-foreground">Resolva os itens abaixo.</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {head("Visitas sem funil", nF)}
          <PendingFunnelSection enabled={enabled} />
          {head("Agendamentos sem resposta", nA)}
          <PendingAttendanceSection enabled={enabled} />
        </div>
        <div className="flex justify-end border-t border-border p-3">
          <Button variant="outline" onClick={snooze}>Lembrar depois</Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { completePasswordChange } from "@/lib/ext/usuarios.functions";
import { Button, Card, Input, Label } from "@/components/ui";

export function ForcePasswordChange({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await completePasswordChange({ data: { password } });
      toast.success("Senha alterada.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-xl font-semibold text-foreground">Defina sua nova senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O administrador solicitou a troca da sua senha antes de continuar.
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {[
            { id: "np", label: "Nova senha", v: password, set: setPassword },
            { id: "cp", label: "Confirmar nova senha", v: confirm, set: setConfirm },
          ].map((f) => (
            <div key={f.id} className="relative">
              <Label htmlFor={f.id}>{f.label}</Label>
              <Input
                id={f.id}
                type={show ? "text" : "password"}
                value={f.v}
                onChange={(e) => f.set(e.target.value)}
                minLength={6}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                className="absolute bottom-2.5 right-3 p-1 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          ))}
          <Button type="submit" disabled={loading}>
            {loading ? "Aguarde..." : "Salvar nova senha"}
          </Button>
          <Button type="button" variant="ghost" onClick={onSignOut}>
            Sair
          </Button>
        </form>
      </Card>
    </main>
  );
}

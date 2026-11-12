import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { getSupabase } from "@/lib/ext/browser";
import { recordAccess, recordFailedLogin } from "@/lib/ext/logs.functions";
import { Button, Card, Input, Label } from "@/components/ui";
import logoAsset from "@/assets/grupo-inter-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Portal de Matrículas" },
      { name: "description", content: "Acesse o portal de matrículas." },
      { property: "og:title", content: "Entrar — Grupo Inter" },
      {
        property: "og:description",
        content: "Acesse o portal de matrículas do Grupo Inter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        void recordFailedLogin({ data: { email } }).catch(() => {});
        throw error;
      }
      sessionStorage.setItem("access-logged", "1");
      localStorage.removeItem("pending-tasks-snooze");
      void recordAccess({ data: { event: "login" } }).catch(() => {});
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary" />
      <Card className="relative w-full max-w-md border-border/70 p-7 shadow-[0_24px_70px_-36px_oklch(0.34_0.105_287_/_0.5)] sm:p-10">
        <div className="mb-9 text-center">
          <img src={logoAsset.url} alt="Grupo Inter" className="mx-auto h-auto w-56 max-w-full" />
          <h1 className="mt-7 font-display text-xl font-semibold text-foreground">
            Portal de Matrículas
          </h1>
        </div>
        <p className="text-center text-sm text-muted-foreground">Entre com sua conta</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="relative">
            <Label htmlFor="email">E-mail</Label>
            <Mail className="pointer-events-none absolute bottom-3.5 left-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10"
            />
          </div>
          <div className="relative">
            <Label htmlFor="password">Senha</Label>
            <LockKeyhole className="pointer-events-none absolute bottom-3.5 left-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute bottom-2.5 right-3 p-1 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "Aguarde..." : "Entrar"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      </Card>
    </main>
  );
}

import { createMiddleware } from "@tanstack/react-start";
import { getSupabase } from "./browser";

// Anexa o bearer token da sessão a todas as chamadas de server function.
// Se o token estiver prestes a expirar, renova antes de enviar — evita
// respostas "não autorizado" que derrubariam o usuário sem motivo.
export const attachExtSupabaseAuth = createMiddleware({
  type: "function",
}).client(async ({ next }) => {
  const supabase = await getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let active = session;
  const expiresAt = session?.expires_at ?? 0;
  const nearExpiry = expiresAt > 0 && expiresAt * 1000 - Date.now() < 60_000;
  if (session && nearExpiry) {
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data.session) active = data.session;
    } catch {
      // Mantém o token atual; o servidor decide se ainda é válido.
    }
  }

  const token = active?.access_token;
  return next(token ? { headers: { Authorization: `Bearer ${token}` } } : {});
});

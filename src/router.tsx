import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { getSupabase } from "./lib/ext/browser";

function isUnauthorized(error: unknown) {
  return error instanceof Error && /unauthorized/i.test(error.message);
}

// Evita mandar o usuário para o login por causa de uma falha passageira.
// Só volta para /auth quando a sessão realmente não existe mais — assim o
// mesmo usuário pode ficar logado em vários computadores e navegadores.
let checkingSession: Promise<void> | undefined;

function handleUnauthorized(queryClient: QueryClient) {
  if (typeof window === "undefined") return;
  if (checkingSession) return;
  checkingSession = (async () => {
    try {
      const supabase = await getSupabase();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Sessão viva: renova o acesso e tenta as telas de novo.
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session) {
          await queryClient.refetchQueries({ type: "active" });
          return;
        }
      }
      const { data: user } = await supabase.auth.getUser();
      if (user.user) return;
      window.location.replace("/auth");
    } catch {
      window.location.replace("/auth");
    } finally {
      // Libera uma nova verificação depois de um instante.
      setTimeout(() => {
        checkingSession = undefined;
      }, 5_000);
    }
  })();
}

export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isUnauthorized(error)) handleUnauthorized(queryClient);
      },
    }),
    defaultOptions: {
      queries: {
        retry: (count, error) => (isUnauthorized(error) ? count < 1 : count < 3),
        // Mantém as telas atualizadas sem precisar recarregar a página.
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

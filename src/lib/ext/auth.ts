import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Middleware de autenticação para server functions: valida o bearer token
// contra o Supabase externo e expõe um cliente com RLS do usuário.
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { extAnon, extUserClient } = await import("./server");
  const request = getRequest();
  const header = request?.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Unauthorized");

  const anon = extAnon();
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");

  return next({
    context: {
      supabase: extUserClient(token),
      userId: data.user.id,
      userEmail: data.user.email ?? "",
    },
  });
});

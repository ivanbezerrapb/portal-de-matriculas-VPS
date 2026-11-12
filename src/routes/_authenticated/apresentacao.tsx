import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/apresentacao")({
  beforeLoad: async () => {
    throw redirect({ to: "/cadastros", replace: true });
  },
});

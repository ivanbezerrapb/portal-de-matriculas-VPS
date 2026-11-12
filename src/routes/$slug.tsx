import { createFileRoute } from "@tanstack/react-router";
import { PublicForm, publicFormQuery } from "@/components/PublicForm";

export const Route = createFileRoute("/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicFormQuery(params.slug)),
  head: ({ params }) => ({
    meta: [
      { title: "Formulário — Formulários Escolares" },
      { name: "description", content: `Preencha o formulário ${params.slug}.` },
      { property: "og:title", content: "Formulário público — Grupo Inter" },
      { property: "og:description", content: `Preencha o formulário ${params.slug}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShortPublicFormRoute,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-destructive">Erro ao carregar: {(error as Error).message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Formulário não encontrado.</p>
    </div>
  ),
});

function ShortPublicFormRoute() {
  const { slug } = Route.useParams();
  return <PublicForm slug={slug} />;
}

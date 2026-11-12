# Link público curto com o nome do formulário

## Objetivo

Ao publicar um formulário, o link público passa a ser curto e legível, usando o
próprio nome do formulário:

```text
antes:  https://painel.grupointereducacional.online/f/87fed826-67a3-4ba9-8abf-b57a725e...
depois: https://painel.grupointereducacional.online/novos-leads-expedicionarios
```

## Regras combinadas

- Formulários já publicados **não mudam** de endereço.
- O endereço curto é gerado no momento em que o formulário é **publicado**.
  Quem estiver publicado hoje só ganha o novo formato depois de **Encerrar** e
  **Publicar novamente**.
- Os endereços antigos (com o código longo) continuam funcionando para sempre,
  inclusive depois de o formulário ganhar o endereço curto.
- Se dois formulários gerarem o mesmo nome de endereço, o segundo recebe um
  número no fim (`novos-leads-expedicionarios-2`).
- O nome é convertido para letras minúsculas, sem acentos, com hífens no lugar
  dos espaços e sem pontuação.

## O que será feito

1. Ao publicar, o sistema monta o endereço curto a partir do título, confere se
   já está em uso por outro formulário e grava no formulário.
2. O portal passa a abrir o formulário tanto pelo endereço curto
   (`/novos-leads-expedicionarios`) quanto pelo endereço antigo (`/f/<código>`).
3. A tela Publicar e a lista de formulários passam a exibir e copiar o endereço
   curto quando ele existir.
4. Endereços curtos nunca podem colidir com as páginas internas do portal
   (início, cadastros, leads, crm, configurações, etc.); nesses casos o sistema
   acrescenta um sufixo automaticamente.

## Detalhes técnicos

- `setFormStatus` (src/lib/ext/formularios.functions.ts): ao mudar para
  `published`, gera o slug a partir de `title` (normalização NFD + remoção de
  diacríticos, `[^a-z0-9]+` → `-`), verifica unicidade em `forms.public_slug` e
  contra a lista de rotas reservadas, e atualiza `public_slug` junto do status.
  Transições para `draft`/`closed` não alteram o slug.
- Nova rota `src/routes/$slug.tsx` (splat de um segmento na raiz): resolve o
  formulário por `public_slug` e reaproveita o mesmo componente/loader de
  `src/routes/f/$slug.tsx`; quando não encontrar, retorna `notFound()`. Rotas
  estáticas existentes têm precedência no TanStack Router, então nada interno é
  afetado.
- `publico.functions.ts` continua buscando por `public_slug`, sem alteração —
  o valor antigo (UUID) permanece válido até a republicação.
- UI: `formularios_.$formId.tsx` (linha ~513) e `formularios.tsx` (linha ~197)
  passam a montar `${origin}/${public_slug}`.
- Sem migração de banco: `forms.public_slug` já existe e é texto único.

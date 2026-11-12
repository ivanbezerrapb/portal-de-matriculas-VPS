# Histórico de anotações no cartão + botão do WhatsApp

## 1. Histórico de informações (caixa de texto)

No painel do cartão, abaixo das Tarefas, entra uma nova seção **Histórico**:

- Caixa de texto para escrever a anotação e botão **Registrar**.
- Cada registro salvo fica gravado com o nome de quem escreveu e a data e hora.
- Ao abrir o cartão, aparecem todas as anotações, da mais recente para a mais antiga,
  no formato: `Nome · 20/09/2026 21:30` e o texto abaixo, respeitando quebras de linha.
- Quem só tem leitura (Direção) vê o histórico, mas não escreve.
- Quem escreveu pode apagar a própria anotação; Administrador pode apagar qualquer uma.
- Sem anotações, aparece "Nenhum registro ainda."

## 2. Ícone do WhatsApp ao lado do telefone

- Logo após o número de telefone no painel do cartão, um ícone verde do WhatsApp.
- Ao clicar, abre o WhatsApp em nova aba já com a conversa desse contato.
- O número é montado como `55` + o número cadastrado (somente dígitos, sem o zero inicial
  do DDD e sem repetir o 55 quando já vier no cadastro).
- Se o número não tiver dígitos suficientes (menos de 10), o ícone não aparece.

## Detalhes técnicos

- Banco (Supabase externo): nova tabela `opportunity_notes`
  (`id`, `opportunity_id` FK → `opportunities` ON DELETE CASCADE, `author_id`,
  `author_name`, `body` text, `created_at`), com GRANTs para `authenticated`/`service_role`,
  RLS ativa e leitura/escrita alinhadas às policies já usadas em `opportunity_tasks`
  (mesma escola/funil do cartão); DELETE para o autor ou admin.
- `src/lib/ext/pipeline.functions.ts`: `listOpportunityNotes`, `createOpportunityNote`,
  `deleteOpportunityNote`, todas com `requireSupabaseAuth`, validando acesso ao cartão
  do mesmo modo que as funções de tarefas já fazem; o nome do autor vem de `profiles`.
- `src/routes/_authenticated/crm.pipeline.tsx`: novo componente `OpportunityNotes`
  (mesmo padrão de `OpportunityTasks`, com `useQuery` + `useMutation` e invalidação
  da query `["crm-notes", id]`), renderizado logo abaixo de `<OpportunityTasks />`.
- Telefone: helper `whatsappHref(phone)` em `src/lib/ext/model.ts` normalizando dígitos
  e gerando `https://wa.me/55XXXXXXXXXXX`; ícone `MessageCircle` (lucide-react) em
  link `target="_blank" rel="noopener noreferrer"` ao lado do `<dd>` do telefone.
- Sem alterações nas regras de matrícula, funis ou indicadores.

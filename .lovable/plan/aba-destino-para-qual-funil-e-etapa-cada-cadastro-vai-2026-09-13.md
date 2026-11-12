# Aba "Destino": para qual funil e etapa cada cadastro vai

Nova aba **Destino** na configuração de cada formulário, com regras que decidem se o cadastro
vira uma oportunidade no CRM e em qual funil/etapa ele entra.

## Como vai funcionar

### Aba Destino (Configurações › Formulários › abrir o formulário)

1. **Mapeamento do cartão** — você escolhe qual campo do formulário vira o **nome**, o **telefone**
   e o **e-mail** do cartão no Pipeline. Se não escolher, o cartão usa o ID do cadastro.
2. **Regras, em ordem** — cada regra tem:
   - um ou mais **critérios** sobre as respostas (campo + comparação + valor);
   - o **destino**: funil e etapa, ou a opção **"Não enviar para o CRM"**;
   - botões para subir/descer, editar e excluir.
   Vale a **primeira regra cujos critérios forem todos atendidos**.
3. **Destino padrão** — usado quando nenhuma regra bate. Pode ser um funil/etapa ou
   "Não enviar para o CRM".
4. **Aplicar aos cadastros já existentes** — botão que reprocessa os cadastros daquele formulário
   com as regras atuais (cria as oportunidades que faltam; não duplica as que já existem).

Comparações disponíveis conforme o tipo do campo: é igual a, é diferente de, contém, está vazio,
não está vazio, está entre as opções selecionadas, maior que, menor que (número/data),
quantidade de crianças maior/menor que.

### Cadastro bloqueado

Continua salvo normalmente, apenas marcado como **não enviado ao CRM**, guardando o motivo
(qual regra bloqueou). Isso aparece na tela de detalhe do cadastro.

### Pipeline

Cada oportunidade continua sendo um cartão; passam a respeitar o funil/etapa definido pelas regras
em vez de sempre cair na primeira etapa do funil padrão.

## Detalhes técnicos

**Banco (migração no Supabase externo via psql):**
- `public.form_destinations` — 1 linha por formulário: `form_id` (único), `name_field_id`,
  `phone_field_id`, `email_field_id`, `default_funnel_id`, `default_stage_id`,
  `default_send boolean`, timestamps. GRANTs + RLS (SELECT igual a `forms_select`; escrita só admin).
- `public.form_destination_rules` — `id`, `form_id`, `position`, `send boolean`, `funnel_id`,
  `stage_id`, `conditions jsonb` (lista de `{field_id, op, value}`), `label`. GRANTs + RLS iguais.
- `public.submissions` ganha `crm_status text` (`sent` | `blocked` | `none`, default `none`) e
  `crm_reason text` — colunas novas, aditivas.

**Servidor:**
- Novo `src/lib/ext/destino.functions.ts`: `getDestination`, `saveDestination`, `saveRules`,
  `reprocessSubmissions` (todos com `requireAuth`; escrita restrita a admin).
- Novo módulo compartilhado `src/lib/ext/destino.ts` com `evaluateRules(values, fields, rules)` puro,
  usado tanto no envio público quanto no reprocessamento.
- `src/lib/ext/publico.functions.ts`: substituir o bloco atual de criação automática de oportunidade
  pela avaliação das regras; gravar `crm_status`/`crm_reason` na submissão.

**Interface:**
- `src/routes/_authenticated/formularios_.$formId.tsx`: adicionar `"destino"` ao estado `tab` e à
  barra de abas, e um componente `DestinationTab` seguindo o padrão visual das abas existentes.
- `src/routes/_authenticated/cadastros_.$submissionId.tsx`: etiqueta com a situação no CRM.

Validação final: prettier, tsgo, eslint e verificação da aba no preview.

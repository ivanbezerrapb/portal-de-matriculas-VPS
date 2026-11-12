# Lista de LEADS

Nova listagem separada da Lista de Visitantes, com formulários que escolhem para qual lista enviam.

## Menu

```text
CADASTROS
  Lista de Visitantes   (como hoje)
  Lista de LEADS        (novo)
```

Mesmas permissões por unidade e perfil já usadas na Lista de Visitantes.

## Numeração dos leads

ID somente numérico, sequencial por unidade:

- Centro: 1001, 1002, 1003...
- Cristo: 2001, 2002...
- Bessa: 3001, 3002...
- Expedicionários: 4001, 4002...

A numeração dos visitantes continua exatamente como está (0001/CE2027 etc.) e as duas sequências são independentes.

## Formulários

- Ao criar um novo formulário, aparece a escolha "Enviar para: Lista de Visitantes / Lista de LEADS".
- Depois de criado, o formulário mostra a qual lista pertence (selo na listagem) e a escolha fica travada, para não misturar cadastros já recebidos.
- Campos, modelo de impressão, publicação e aba Destino funcionam igual nos dois tipos.
- Todos os formulários existentes continuam como Lista de Visitantes; nada muda no que já está em funcionamento.

## Tela Lista de LEADS

Mesma tela da Lista de Visitantes: mesmas colunas (ID, escola, série, funil, matrícula, atendimento, efetivação, data), filtros, busca, visualizar, imprimir e ícone do WhatsApp. Mostra apenas cadastros de formulários do tipo LEADS; a Lista de Visitantes mostra apenas os de visitantes.

## CRM

Formulários de LEADS enviam cartões para o CRM pela aba Destino, com as mesmas regras de funil, etapa, responsável e primeiro contato.

## Início

Os indicadores atuais continuam contando só visitantes. Os leads não entram nesses números; indicadores próprios de leads ficam para uma etapa seguinte.

## Detalhes técnicos

- Migração no banco externo: `forms.list_type text not null default 'visitantes'` (check em 'visitantes'/'leads'); `submissions.list_type text not null default 'visitantes'`; `schools.lead_next_number integer not null default 1001`, semeado por unidade (Centro 1001, Cristo 2001, Bessa 3001, Expedicionários 4001); função `next_school_lead_id(uuid)` com o mesmo bloqueio de linha de `next_school_public_id`, retornando só o número.
- `publico.functions.ts`: ao enviar, lê `forms.list_type`; se `leads`, usa `next_school_lead_id` e grava `submissions.list_type='leads'`.
- `cadastros.functions.ts`: `listSubmissions` e derivados recebem parâmetro `list_type` (padrão `visitantes`) e filtram por ele.
- Rota `src/routes/_authenticated/leads.tsx` reaproveitando o componente da Lista de Visitantes com `list_type='leads'`, título e `head()` próprios; item no menu em `_authenticated/route.tsx`.
- `formularios.tsx`/`formularios.functions.ts`: seletor de lista na criação, selo na listagem, `list_type` copiado na duplicação.
- Dashboard e funções de indicadores passam a filtrar `list_type='visitantes'` para manter os números atuais.

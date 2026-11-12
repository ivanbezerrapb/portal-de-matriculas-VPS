# Cartão em tela cheia + Editar para a Central de Informações

## O que muda
- **CRM › Pipeline e Funil**: quando um usuário da **Central de Informações** clicar num cartão, abre uma **janela grande** (quase tela cheia) no lugar da janela lateral.
- A janela mostra o mesmo conteúdo de hoje (Dados do cliente, Responsável, Data da visita, Tarefas, Histórico), em duas colunas para aproveitar o espaço: dados do contato à esquerda, visita, tarefas e histórico à direita.
- No topo de **Dados do cliente** aparece o botão **Editar**. Ele troca os dados por campos editáveis, usando os mesmos campos do formulário de origem (Nome, Telefone, Origem do contato, Série, Endereço etc.), com **Salvar** e **Cancelar**.
- Vale para cartões vindos da **Lista de LEADS** e da **Lista de Visitantes**.
- Ao salvar, o cartão, a ficha e a lista são atualizados, e a alteração aparece no **Histórico** e no **Log de Registro** (campo anterior → novo).
- Os outros perfis continuam com a janela lateral como hoje. Administrador e Gerente da unidade também ganham o botão **Editar** na janela lateral, já que hoje eles podem editar pela ficha completa.

## Permissões
- A Central só pode editar cadastros das unidades em que está vinculada.
- Direção continua somente leitura.

## Detalhes técnicos
- `updateSubmission` (`cadastros.functions.ts`): passa a aceitar também `perms.infoCenterSchools.includes(school_id)`; os demais pontos (log, histórico) ficam iguais.
- `crm.pipeline.tsx`: o painel do cartão (linha ~613) recebe um modo `wide` (`max-w-6xl`, centralizado, `h-[92vh]`, grid de 2 colunas) ativado quando o usuário é da Central; extrair o formulário de edição em componente reutilizável (`SubmissionEditForm`) baseado no modo de edição de `cadastros_.$submissionId.tsx`, carregando campos/valores via `getSubmission`.
- `crm.funil.tsx`: usa o mesmo painel/componente.
- Após salvar: invalidar as queries do pipeline, da ficha e das listas.

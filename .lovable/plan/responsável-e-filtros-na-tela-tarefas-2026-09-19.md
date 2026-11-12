# Responsável e filtros na tela Tarefas

## O que será feito

- Cada cartão do CRM passará a guardar um **responsável próprio**.
- Em **CRM › Tarefas**, cada tarefa mostrará duas TAGs:
  - **Funil:** nome do funil do cartão.
  - **Responsável:** nome da pessoa escolhida para atender o cartão; quando ainda não houver alguém definido, mostrará **Sem responsável**.
- A tela ganhará três filtros combináveis:
  - **Escola**
  - **Funil**
  - **Responsável**
- Os filtros respeitarão as permissões existentes:
  - Central de Informações verá somente escolas e funis aos quais está vinculada.
  - Gerente verá apenas suas unidades.
  - Administrador e Direção poderão consultar todas as unidades permitidas ao perfil.
- Ao alterar Escola, as opções de Funil e Responsável serão reduzidas ao contexto daquela escola. Ao alterar Funil, o filtro Responsável mostrará somente pessoas vinculadas a ele.
- O filtro atual de situação (**Pendentes, Feitas ou Todas**) será mantido e funcionará junto com os novos filtros.

## Definição do responsável do cartão

- No envio de um visitante para o CRM:
  - se o funil tiver um responsável, ele será gravado automaticamente no cartão;
  - se tiver mais de um, a pessoa escolhida na janela será gravada no cartão;
  - o nome continuará preenchendo também a coluna Atendimento na Lista de Visitantes.
- Na criação ou edição de uma oportunidade manual, haverá um campo **Responsável**, limitado às pessoas vinculadas ao funil selecionado.
- Cartões já existentes serão preenchidos automaticamente somente quando o funil possuir exatamente um responsável. Os demais continuarão como **Sem responsável** até serem editados, evitando atribuições incorretas.

## Detalhes técnicos

- Adicionar `owner_id` em `opportunities`, relacionado ao perfil do usuário responsável, sem criar ou alterar dados de visitantes e formulários.
- Atualizar os fluxos de criação, edição e envio ao funil para validar que o responsável escolhido está vinculado ao funil e que o funil pertence à unidade do lead.
- Ampliar a consulta de tarefas para retornar escola, funil e responsável e aceitar os três novos filtros no servidor, mantendo o controle de acesso atual.
- Atualizar automaticamente as consultas de Tarefas e Pipeline após mudanças de responsável.
- Ajustar a largura da lista para acomodar as TAGs e filtros sem criar cortes ou sobreposição.

## Validação

- Testar tarefas com um responsável, vários responsáveis e sem responsável.
- Confirmar combinações dos filtros Escola, Funil, Responsável e situação.
- Confirmar que cada perfil enxerga somente as unidades e funis permitidos.
- Confirmar abertura do cartão pelo botão **Abrir**, conclusão e exclusão da tarefa sem regressões.

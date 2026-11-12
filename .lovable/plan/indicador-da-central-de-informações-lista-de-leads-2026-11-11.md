# Indicador da Central de Informações (Lista de LEADS)

## O que muda
- Logo abaixo do card "Quem mais atendeu (Coordenação)", no Início, entra um novo card: **"Quem mais atendeu (Central de Informações)"**.
- Ele conta só os cadastros da **Lista de LEADS**, agrupados pelo usuário da Central de Informações responsável pelo card no funil LEAD:
  - **Vinculados**: LEADS atribuídos a cada usuário da Central.
  - **Iniciados**: cards que esse usuário já moveu para a 2ª etapa ou além (mesma regra do card da Coordenação).
- Separado por unidade (Bessa, Centro, Cristo, Expedicionários), com os mesmos filtros de escola e ano letivo, e mesmas cores e legenda.
- O card da Coordenação continua igual, contando só a Lista de Visitantes.

## Detalhes técnicos
- Em `cadastros.functions.ts`, buscar as oportunidades dos envios `list_type = "leads"` no período/escolas filtrados, agrupar por `owner_id` (nome via perfis; sem responsável = "Sem responsável"), aplicar a mesma regra de "iniciado" e devolver `leadOwnersBySchool`.
- Em `dashboard.tsx`, renderizar outro `NeighborhoodChart` com `showStarted` usando esses dados, logo abaixo do atual.

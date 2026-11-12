# Check-in na Lista de LEADS

## Alterações na listagem

- Aplicar as mudanças somente na **Lista de LEADS**, mantendo a Lista de Visitantes como está.
- Retirar a coluna **Crianças**.
- Manter a coluna **Série**, exibindo uma série por linha com base no que foi informado no formulário.
- Substituir **Matrícula** por **Check-in**.
- Criar a coluna **Data do check-in**, exibindo a data e hora em que ele foi confirmado.

## Confirmação do check-in

- Ao marcar **Check-in**, abrir uma janela confirmando a ação para aquele LEAD.
- Ao confirmar, registrar automaticamente a data e hora atual e o usuário que realizou a ação.
- O check-in será definitivo: depois de confirmado, não poderá ser desmarcado pela listagem.
- Mostrar o check-in confirmado e sua data imediatamente após salvar.

## Integração com o CRM

- Quando a Secretaria confirmar o check-in e o LEAD possuir cartão no CRM:
  - marcar o cartão automaticamente como **Ganho**;
  - registrar o fechamento como check-in realizado;
  - concluir todas as tarefas ainda pendentes desse cartão, incluindo tarefas atuais e futuras de contato.
- Se o LEAD ainda não estiver associado a um funil, registrar o check-in normalmente e informar que não havia cartão para fechar.
- Atualizar automaticamente a Lista de LEADS, Pipeline e Tarefas após a confirmação.

## Dados e permissões

- Adicionar ao cadastro do LEAD os registros próprios de check-in: situação, data/hora e usuário responsável.
- Não reutilizar os campos de matrícula, evitando que check-ins sejam contabilizados como matrículas ou alterem os indicadores atuais.
- Permitir a confirmação para Administrador, Gerente e Secretaria dentro das mesmas regras de unidade já usadas na listagem.
- Manter Direção somente para leitura.
- Registrar a ação no histórico de alterações do cadastro.

## Validação

- Confirmar a exibição das séries informadas no formulário.
- Testar check-in de um LEAD com cartão e tarefas pendentes/futuras, verificando o ganho e a conclusão das tarefas.
- Testar check-in sem cartão no CRM.
- Confirmar que o check-in não pode ser desfeito e que a Lista de Visitantes permanece inalterada.

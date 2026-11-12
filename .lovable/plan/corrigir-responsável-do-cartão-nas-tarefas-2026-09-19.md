# Corrigir responsável do cartão nas Tarefas

## Diagnóstico confirmado

- O cartão da visitante `0003/CE2027` está no funil **Centro - Pós Visita (Fund II e Médio)**, mas seu campo de responsável próprio está vazio.
- **Fabiana Grisi** está registrada no campo **Atendimento** da visitante, que é separado do responsável do cartão.
- Esse funil possui dois usuários vinculados: **Central Conecta** e **Fabiana Grisi**. Por isso, a regra automática de “usar o único responsável do funil” não pode escolher um deles.

## Alterações

1. Ao enviar uma visitante para um funil com mais de um usuário vinculado, exigir a escolha do responsável antes de concluir o envio.
2. Gravar a pessoa escolhida diretamente como responsável próprio do cartão e manter seu nome em Atendimento.
3. Para cartões antigos sem responsável, permitir atribuição pelo Pipeline; após a escolha, a TAG em Tarefas passará a mostrar o nome.
4. Manter a atribuição automática quando o funil possuir exatamente um usuário vinculado.
5. Validar os fluxos com zero, um e vários responsáveis e confirmar que os filtros de Tarefas refletem a atribuição.

## Observação

O cartão mostrado continuará como **Sem responsável** até receber uma escolha, porque não é seguro selecionar automaticamente entre os dois usuários vinculados ao funil.

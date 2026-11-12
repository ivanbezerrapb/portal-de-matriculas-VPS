# Corrigir erro ao retirar cadastro do funil

## Causa
Ao escolher **Sem funil**, o portal tentava deixar vazia a situação do cadastro no CRM. O banco não aceita esse campo vazio, por isso apareceu o erro. Antes do erro, o cartão já tinha saído do Pipeline e as tarefas já tinham sido canceladas, mas o cadastro não foi atualizado (o Atendimento continuou preenchido).

## Correção
- Gravar a situação do cadastro como "sem CRM" (o mesmo valor usado hoje para cadastros sem funil), em vez de deixar vazio.
- Atualizar o cadastro **antes** de mexer no cartão, para que um erro não deixe as coisas pela metade.
- Conferir o cadastro do teste que deu erro: limpar o Atendimento e deixar a coluna Funil como "—".

## Detalhes técnicos
- `removeSubmissionFromFunnel` (cadastros.functions.ts): `crm_status: "none"` no lugar de `null`; mover o update de `submissions` para antes do loop das oportunidades.
- Corrigir os dados do cadastro afetado: localizar a oportunidade com `close_note = 'Retirado do funil pelo Administrador'` criada hoje e aplicar `attendant_id = null, crm_status = 'none'` no cadastro correspondente (pelo histórico em `crm_notes`).

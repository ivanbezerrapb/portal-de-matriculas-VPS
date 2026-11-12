# Administrador: trocar ou retirar o funil de um cadastro

## O que muda para você
- Na coluna **Funil** das listas de Visitantes e LEADS, o Administrador terá uma opção nova: **Sem funil**.
- Ao escolher **Sem funil**, aparece uma confirmação. Ao confirmar:
  - o cartão sai do Pipeline (fica arquivado, nada é apagado);
  - as tarefas pendentes dele são canceladas;
  - o Atendimento do cadastro fica vazio;
  - o Histórico e o Log de Registro registram quem retirou e quando.
- **Trocar de funil** continua funcionando como hoje (o cartão vai para a 1ª etapa do novo funil), mas agora com confirmação quando o cadastro já tinha funil, para evitar troca sem querer.
- Cadastros já ganhos (check-in ou matrícula) não podem ser retirados do funil, para não bagunçar os indicadores.
- Gerentes e Secretaria seguem como hoje: não veem a opção "Sem funil".

## Detalhes técnicos
- Nova server fn `removeSubmissionFromFunnel` em `cadastros.functions.ts`: exige `perms.isAdmin`; bloqueia se a oportunidade estiver `won`; marca oportunidade aberta como fechada/arquivada (status `lost` sem motivo ou exclusão lógica conforme campos existentes), cancela tarefas abertas, limpa `attendant` do cadastro, grava nota em `crm_notes` e log de auditoria.
- `SubmissionsList.tsx`: incluir `<option value="__remove">Sem funil</option>` só para admin quando há funil atual; diálogo de confirmação; confirmação também ao trocar funil existente; invalidar queries de cadastros/pipeline.

# Botão "Faltou" no Calendário

## O que muda
Na janela da visita no Calendário, entre "Dar check-in" e "Fechar", aparece o botão **Faltou** (só para visitas Agendadas de LEADS).

Ao clicar:
1. Abre uma confirmação: "Confirmar que o cliente não compareceu à visita de DD/MM/AAAA às HH:mm?" com Cancelar / Sim, faltou.
2. O cartão é movido para a etapa **"Reagendar visita"** do mesmo funil.
3. No **Histórico** do cartão fica registrado: "Faltou à visita agendada para DD/MM/AAAA às HH:mm", com nome, data e hora de quem marcou.
4. A data da visita é apagada, então o item some do Calendário e a Central vê o cartão em "Reagendar visita" para marcar nova data (ao arrastar de novo para "Visita agendada", a janela de data já abre normalmente).

## Quem pode
Os mesmos que podem dar check-in: Administrador, Gerente e Secretaria da unidade. Direção só visualiza.

## Regra se faltar a etapa
Se o funil não tiver uma etapa com nome "Reagendar visita" (sem diferenciar maiúsculas/acentos), aparece o aviso "Crie a etapa Reagendar visita neste funil" e nada é alterado.

## Detalhes técnicos
- Nova server fn `markVisitNoShow({ opportunity_id })` em `calendario.functions.ts`: valida permissão igual ao check-in, confere `list_type='leads'` e `visit_at` não nulo, encontra a etapa por nome normalizado contendo "reagend", move para o fim dessa coluna, zera `visit_at`, insere em `crm_notes` com autor.
- `calendario.tsx`: botão Faltou + diálogo de confirmação; invalida calendário e pipeline.

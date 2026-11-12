# Ícone do WhatsApp: link confirmado funcionando

## Análise dos dois prints

1. Primeiro print: o número montado está correto — `5571992049102` = país 55 + DDD 71 + 992049102.
   O erro "api.whatsapp.com está bloqueado" foi uma recusa pontual de conexão
   (extensão, antivírus ou rede), não um problema do portal.
2. Segundo print: o mesmo endereço abriu normalmente, mostrando a tela
   "Conversar com +55 71 99204-9102 no WhatsApp" com os botões "Abrir app" e
   "Continuar para o WhatsApp Web". Ou seja: o ícone está funcionando como previsto.

## O que muda

Nenhuma mudança de código. O link atual (wa.me, que leva ao api.whatsapp.com)
está correto e operacional. Se o bloqueio aparecer de novo em algum computador,
será um bloqueio daquela máquina ou rede ao domínio do WhatsApp — aí vale liberar
o domínio ou testar em outra rede.

## Detalhes técnicos

- `src/routes/_authenticated/crm.pipeline.tsx`: função `whatsappHref` mantida como está
  (DDI 55 fixo + DDD do próprio telefone, ícone escondido se o número for curto demais).
- Nenhuma alteração no banco, nas permissões ou no histórico do cartão.

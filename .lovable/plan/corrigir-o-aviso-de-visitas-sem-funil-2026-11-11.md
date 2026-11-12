# Corrigir o aviso de visitas sem funil

## Causa
Quando o aviso do Calendário é resolvido ou adiado, o aviso de visitas sem funil tenta abrir. Nesse momento ele lê a lista de funis no formato errado, e a tela inteira quebra. Por isso aparece "Não foi possível abrir esta tela" e o aviso nunca chega a aparecer.

## Correção
- Ler a lista de funis no formato certo.
- Proteger o aviso: se algum dado vier vazio ou inesperado, ele não derruba mais a tela.
- Conferir no preview que a lista de LEADS abre normalmente e que não há erros de compilação.

## Detalhes técnicos
- `PendingFunnelDialog.tsx`: `listFunnels()` retorna `{ funnels, stages }`; usar `data?.funnels ?? []` em vez de tratar o retorno como array. Usar `Array.isArray` como proteção para os responsáveis e as linhas.

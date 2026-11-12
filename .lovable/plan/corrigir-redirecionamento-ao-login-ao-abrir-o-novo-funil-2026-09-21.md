# Corrigir redirecionamento ao login ao abrir o novo funil

## Diagnóstico confirmado

- O Pipeline passou a usar `card.series.length`, mas dados antigos ainda mantidos no cache do navegador podem não conter `series`.
- Isso causa o erro `Cannot read properties of undefined (reading 'length')` registrado no Pipeline.
- A área protegida usa uma tela de erro que redireciona qualquer falha para o login, mesmo quando a sessão continua válida. Por isso o problema parece ser um logout.

## Correção

1. Tornar a exibição das séries compatível com cartões antigos e novos, tratando série ausente como uma lista vazia tanto no cartão quanto no painel de detalhes.
2. Ajustar o tratamento de erros da área protegida para redirecionar ao login somente quando a sessão realmente estiver ausente ou expirada; erros de tela não devem encerrar uma sessão válida.
3. Manter o novo formato **ID + Nome** e a exibição das séries sem alterar funis, responsáveis ou dados existentes.
4. Validar a troca entre funis, a abertura de cartões antigos e novos e confirmar que nenhuma dessas ações leva ao login com a sessão ativa.

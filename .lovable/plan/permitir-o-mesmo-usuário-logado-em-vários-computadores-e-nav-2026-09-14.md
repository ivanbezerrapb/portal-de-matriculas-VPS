# Permitir o mesmo usuário logado em vários computadores e navegadores

## O que foi verificado

Consultei as sessões guardadas no sistema de login: hoje existem **duas sessões simultâneas ativas para o mesmo usuário** (criadas com 3 minutos de diferença) e nenhuma foi marcada como cancelada. Ou seja, o servidor de login **não** está derrubando a sessão anterior.

Por isso a causa da saída ainda **não está confirmada**. O mais provável é que a queda venha do próprio portal: hoje, se qualquer consulta de tela responde "não autorizado" (por exemplo uma falha momentânea ou uma renovação de acesso que demorou), o portal manda o usuário direto para a tela de login. Isso é uma regra global, aplicada a qualquer erro com essa palavra.

Não vou tratar isso como fato antes de reproduzir.

## Passo 1 — Reproduzir e confirmar a causa

Abrir duas sessões do mesmo usuário (dois navegadores) e, ao entrar na segunda, observar na primeira:

- se ela é enviada para o login sozinha ou só ao clicar em algo;
- qual chamada falhou e com qual mensagem;
- se a sessão daquele navegador foi apagada ou continua válida;
- conferir também as sessões registradas no servidor antes e depois.

O resultado define qual dos ajustes abaixo entra.

## Passo 2 — Ajustes conforme o que aparecer

**Se for o portal derrubando por engano (hipótese principal)**

- Só mandar para a tela de login quando a sessão realmente não existir mais: antes de redirecionar, confirmar com o serviço de login que não há usuário ativo; havendo, apenas renovar o acesso e repetir a consulta.
- Renovar o acesso automaticamente e tentar a consulta de novo uma vez, em vez de encerrar a sessão.
- Evitar que uma atualização de tela em segundo plano (as telas se atualizam sozinhas a cada 30 s) provoque a saída.

**Se for configuração do servidor de login**

- Desligar o limite de uma sessão por usuário / a revogação da sessão anterior, mantendo várias sessões válidas ao mesmo tempo.

**Se for o mesmo navegador em abas diferentes**

- Garantir que cada aba compartilhe a sessão em vez de competir por ela.

## Passo 3 — Validar

Repetir o teste com dois navegadores e confirmar que ambos continuam navegando, imprimindo e salvando sem cair, inclusive depois de vários minutos parados.

## Detalhes técnicos

- `src/router.tsx`: o `QueryCache.onError` hoje faz `window.location.replace("/auth")` para qualquer erro cuja mensagem contenha "unauthorized", e `retry` é desligado nesses casos. Passa a revalidar a sessão (`supabase.auth.getUser()` / `refreshSession()`) antes de redirecionar, e a permitir uma nova tentativa após renovar o token.
- `src/lib/ext/auth-attacher.ts`: garantir token fresco antes de anexar o bearer (usar a sessão renovada quando estiver perto de expirar).
- `src/lib/ext/auth.ts` e `src/integrations/supabase/auth-middleware.ts` permanecem como estão — a validação por bearer não é exclusiva por dispositivo.
- Nenhuma mudança de banco de dados prevista.

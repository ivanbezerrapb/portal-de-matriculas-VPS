# Corrigir importação de contatos antigos que ganharam a etiqueta

## O que descobri
O contato IVANILDO FARIAS existe no Maxbot Conecta há bastante tempo. Hoje a importação só busca contatos **cadastrados** a partir da data inicial (10/11/2026). Como ele foi cadastrado antes, nem entra na busca — por isso o teste disse "Nenhum lead novo", mesmo com as etiquetas certas.

Na prática, é comum colocar a etiqueta em contatos antigos, então a regra atual deixa leads de fora.

## O que vou mudar
- A busca passa a trazer também os contatos **atualizados** a partir da data inicial (o Maxbot permite buscar por "data da última atualização"), além dos cadastrados. As duas listas são juntadas sem repetir.
- Contato com duas etiquetas de unidades diferentes (como o Ivanildo: Centro e Expedicionários) entra **uma vez**, na primeira unidade que casar (ordem: Centro, Expedicionários, Cristo, Bessa). Se preferir que entre nas duas unidades, me avise.
- Continua sem duplicar: contatos já importados ou com telefone já na Lista de LEADS da unidade são pulados.

## Verificação
- Rodar a busca na conta Maxbot Conecta e confirmar que o Ivanildo aparece entre os encontrados.
- Se colocar a etiqueta não alterar a "data de atualização" no Maxbot, aviso você e proponho a alternativa: varrer todos os contatos da conta (mais lento, ~10 mil contatos) só na importação manual.

## Detalhes técnicos
- `runImport` em `src/lib/ext/maxbot.server.ts`: paginar `get_contact` com `focus_period: "0"` e `"1"`, deduplicar por `id`; ordenar o `map` de etiquetas com `compareSchoolNames`.

# Ordenar a lista clicando no título das colunas

## O que muda
Na Lista de Visitantes e na Lista de LEADS, clicar no título de uma coluna ordena a lista por ela:
- 1º clique: crescente (A→Z, menor→maior, mais antiga→mais recente)
- 2º clique: decrescente
- 3º clique: volta à ordem padrão (mais recentes primeiro)

Uma setinha ao lado do título mostra a coluna e o sentido atuais.

Colunas ordenáveis: ID, Responsável, Escola, Crianças, Data, Série, Atendimento, Funil, Matrícula/Check-in e Data do check-in.

## Detalhes técnicos
- `src/components/SubmissionsList.tsx`: estado `sort {key, dir}`; títulos viram botões com ícone (ChevronUp/Down); ordenação no cliente sobre as linhas já carregadas e filtradas, com `localeCompare("pt-BR", {numeric: true})` para textos e IDs, datas por timestamp, vazios sempre no fim.
- Sem mudança no banco nem nas permissões.

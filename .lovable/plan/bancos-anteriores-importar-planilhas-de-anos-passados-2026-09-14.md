# Bancos anteriores (importar planilhas de anos passados)

Novo item **Bancos anteriores** dentro de CONFIGURAÇÕES, visível apenas para o Administrador. Nada nas telas e dados de hoje é alterado — a área guarda os dados antigos em local separado.

## Como vai funcionar

1. A tela lista os bancos já importados: nome, ano letivo, quantidade de linhas, quem importou e quando.
2. Botão **Importar planilha**: escolher o arquivo (.xlsx ou .csv) e informar **nome do banco** e **ano letivo**.
3. Antes de gravar, aparece uma prévia: quantas linhas foram lidas e quais colunas foram reconhecidas.
4. Ao confirmar, o banco é salvo e passa a aparecer na lista.
5. Cada banco pode ser aberto para consulta (tabela com busca e paginação) e excluído pelo Administrador.
6. Colunas em branco, datas e números vêm como estão na planilha; nada é sobrescrito em cadastros atuais.

Primeira carga já incluída: a planilha enviada entra como **BD_VISITAS_2026**, ano letivo 2026 (1.261 registros, período 01/08/2025 a 31/07/2026).

## Estrutura aceita

A planilha atual traz 48 colunas (ficha, responsável, contatos, CEP/bairro/cidade/UF, até 4 alunos com nascimento, série e turno, como conheceu a escola, matriculado, quantidade de matrículas, escola, ID CRM etc.). A importação aceita qualquer conjunto de colunas — planilhas de outros anos com colunas diferentes funcionam sem ajuste de código.

## Detalhes técnicos

- Banco (Supabase externo, via psql): duas tabelas novas e isoladas.
  - `legacy_datasets` (id, name, school_year int, source_filename, columns text[], row_count, created_by, created_at) com nome único por ano letivo.
  - `legacy_rows` (id, dataset_id FK on delete cascade, row_index int, data jsonb) com índice em `dataset_id` e índice GIN em `data`.
  - GRANTs para `authenticated`/`service_role`, RLS ligada, policies SELECT/INSERT/DELETE apenas com `has_role(auth.uid(),'admin')`. Nenhuma policy ou tabela existente é tocada.
- `src/lib/ext/legado.functions.ts`: `listDatasets`, `createDataset` (nome, ano, colunas e linhas já parseadas no cliente), `listRows` (paginado, com busca), `deleteDataset`. Todas checam admin no servidor.
- Leitura da planilha no navegador com a biblioteca `xlsx` (nova dependência), convertendo cada linha em objeto chave→valor.
- `src/routes/_authenticated/configuracoes.bancos-anteriores.tsx`: lista, diálogo de importação (arquivo + nome + ano + prévia) e visualização das linhas; `head()` próprio.
- `src/routes/_authenticated/route.tsx`: novo filho "Bancos anteriores" no grupo Configurações (só admin).
- Carga inicial da planilha enviada feita por script local que insere direto nas duas tabelas novas.

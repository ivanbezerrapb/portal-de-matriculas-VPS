# Apresentação vira listagem de cadastros

## O que muda

A tela **Cadastros › Apresentação** deixa de mostrar os cartões de nomes e passa a mostrar a **listagem dos cadastros** da unidade selecionada, com as colunas:

| Coluna | Conteúdo |
| --- | --- |
| **ID** | código do cadastro (ex.: 0001/EX2027) |
| **Responsável** | nome do responsável |
| **Quem atendeu** | lista suspensa com os nomes de **Secretaria** daquela unidade |
| **Quem apresentou** | lista suspensa com os nomes de **Coordenação** daquela unidade |
| **Status matrícula** | "Ativo" (com a quantidade, ex.: `Ativo · 2`) ou "—" |

## Regras

- O filtro de **Unidade** no topo permanece: a Gerente vê fixa a sua unidade; o Administrador escolhe.
- Cada lista suspensa mostra apenas os nomes **ativos daquela unidade e daquele tipo** — uma unidade nunca vê nomes de outra.
- Ao escolher um nome, o vínculo é salvo na hora (com registro no histórico) e os indicadores da tela Início se atualizam.
- Se o nome ainda não existir, a própria lista oferece **"Cadastrar «nome»"**, que cadastra na unidade e já vincula ao cadastro.
- Quem pode alterar: **Administrador e Gerente**. Secretaria e Central de Informações não acessam a tela.
- Cadastro sem nome informado mostra "—" na coluna.
- A tela se atualiza sozinha a cada 30 segundos, como as demais listagens.
- A manutenção dos nomes (adicionar/renomear/ativar/desativar) continua possível na hora, pela opção "Cadastrar" da lista; os cartões de gerenciamento saem da tela.

## Detalhes técnicos (sem mudança de banco)

- `apresentacao.tsx`: reescrever a página — manter seletor de unidade; query `submissions` (`listSubmissions` já traz `attendant`, `presenter`, `enrolled`, `enrollment_count`) filtrada pela unidade; query `presenters` (`listPresenters` com `only_active`) para as duas listas; `refetchInterval: 30_000`.
- Tabela com as 5 colunas; células de "Quem atendeu" / "Quem apresentou" reutilizam o combobox com autocompletar e opção "Cadastrar «nome»" já usado na Lista de cadastros (`setSubmissionPeople` com `kind: "secretaria" | "coordenacao"`), invalidando `submissions` e `dashboard-stats`.
- Coluna Status matrícula: `enrolled ? `Ativo · ${enrollment_count}` : "—"`.
- Permissão de edição por linha: admin ou gerente da escola do cadastro (`perms.isAdmin || perms.managerSchools.includes(row.school_id)`); sem permissão, célula somente leitura.
- `route.tsx`: sem mudança de menu (o item "Apresentação" já existe sob o grupo Cadastros).

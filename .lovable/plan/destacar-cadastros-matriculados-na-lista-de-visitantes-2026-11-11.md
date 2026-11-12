# Destacar cadastros matriculados na Lista de Visitantes

- Na coluna Matrícula, o selo **"Ativo · N"** passa a se chamar **"Matriculado · N"** (N é a quantidade de matrículas).
- A linha inteira de cada cadastro matriculado ganha um **fundo verde claro**, para dar para ver de longe.
- Ao desmarcar a matrícula, o verde e o selo somem na hora.
- A Lista de LEADS (check-in) não muda.

## Detalhes técnicos
- `SubmissionsList.tsx`: trocar o texto "Ativo" por "Matriculado"; na `<tr>`, quando `enrolled` for verdadeiro e a lista for de visitantes, aplicar fundo verde claro com um token semântico (ex.: `--success-soft` em `src/styles.css`, com versão para modo escuro).

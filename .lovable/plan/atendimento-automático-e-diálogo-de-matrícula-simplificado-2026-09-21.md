# Atendimento automático e diálogo de matrícula simplificado

## O que muda

### 1. Coluna ATENDIMENTO (Lista de Visitantes)
- Deixa de ser editável: não será mais possível digitar nem escolher um nome pela coluna.
- Passa a mostrar apenas o texto do nome já registrado (ou "—" quando vazio).
- O nome é preenchido automaticamente pelo funil:
  - funil com 1 responsável → o nome entra sozinho ao escolher o funil;
  - funil com mais de 1 responsável → abre a janela "Quem atendeu?" para escolher qual responsável informar (comportamento que já existe hoje);
  - funil sem responsável vinculado → segue sem nome.

### 2. Janela "Quantas matrículas foram efetivadas?"
- Remove os campos "Quem atendeu (Secretaria)" e "Quem apresentou (Coordenação)".
- A janela fica só com a quantidade de matrículas, Cancelar e Confirmar.
- Confirmar deixa de exigir esses nomes; grava apenas a quantidade e a matrícula.

## Detalhes técnicos

Arquivo: `src/routes/_authenticated/cadastros.tsx`.

- Célula da coluna Atendimento: trocar `<PersonCell kind="secretaria" …>` por texto simples com o nome de `s.attendant?.name`.
- Diálogo de matrícula: remover os dois blocos `PersonPicker`, os estados `dialogAttendant`/`dialogPresenter` e as duas chamadas `setSubmissionPeople` do handler Confirmar; ajustar a condição `disabled` para validar somente a quantidade (inteiro ≥ 1). Remover `savingEnrollment` se ficar sem uso.
- Manter `pickFunnel`, `funnelDialog` e `sendSubmissionToFunnel` como estão — já cobrem o preenchimento automático e a escolha entre vários responsáveis.
- Limpar imports/estados que ficarem sem uso (`PersonCell`, `PersonPicker` se não forem usados em outro ponto) para não quebrar a verificação de tipos.
- Sem mudanças de banco de dados e sem alteração nos indicadores do Início.

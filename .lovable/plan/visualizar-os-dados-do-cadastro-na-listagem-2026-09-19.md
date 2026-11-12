# Visualizar os dados do cadastro na listagem

## O que muda

Na Lista de Visitantes, antes do ícone da impressora, cada linha ganha um ícone de olho.
Ao clicar, abre uma janela com todos os dados preenchidos daquele cadastro, apenas para leitura.

## Como fica a janela

- Título com o ID do cadastro (ex.: 0008/CE2027), a unidade e o formulário.
- Data e hora do envio.
- Lista de todas as perguntas do formulário, na mesma ordem em que aparecem na ficha,
  com a resposta ao lado. Perguntas sem resposta aparecem com um traço.
- Campos de endereço aparecem em linha legível (rua, número, bairro, cidade, estado, CEP).
- Respostas com várias crianças aparecem uma abaixo da outra, como já acontece na impressão.
- Botão Fechar; a janela rola quando o formulário for longo.

## Quem pode usar

Todos os perfis que já enxergam a linha na listagem (Administrador, Direção, Gerente,
Secretaria e Central de Informações), sempre respeitando as unidades de cada um.
É só leitura: nada pode ser alterado por essa janela.

## Detalhes técnicos

- `src/routes/_authenticated/cadastros.tsx`: novo estado `viewId`, botão com ícone `Eye`
  (lucide-react) inserido na célula de ações imediatamente antes do botão de impressão;
  quando `viewId` está definido, uma consulta `useQuery(["submission", viewId])` chama a
  função de servidor `getSubmission` já existente e o resultado é renderizado num diálogo
  seguindo o padrão visual dos diálogos atuais da tela (overlay + card).
- Sem nova função de servidor: `getSubmission` já devolve `submission`, `fields` (ordenados
  por `position`) e `values` (`part = ""`).
- Formatação das respostas reaproveitando a lógica já usada para exibição: valores de
  endereço (JSON) convertidos em linha legível e valores múltiplos separados por " | "
  quebrados em linhas.
- Sem alteração no banco, nas permissões ou nos cálculos existentes.

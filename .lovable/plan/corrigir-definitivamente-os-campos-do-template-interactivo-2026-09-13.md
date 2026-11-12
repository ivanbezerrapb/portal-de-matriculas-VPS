# Corrigir definitivamente os campos do template Interactivo

## Problema confirmado

O bloco de alunos do template **Impressão Interactivo** está associado ao campo interno numérico **Quantidade de crianças**, e não ao campo **N Filhos** que contém nomes, nascimento, série e turno. Os dois campos têm praticamente o mesmo rótulo, e o reaproveitamento atual escolhe campos apenas pelo nome; por isso ele pode selecionar o campo numérico errado.

Na pré-visualização da biblioteca há um segundo problema: ao escolher outro formulário de referência, os identificadores do layout não são convertidos para os campos desse formulário. Isso explica os textos **“Campo removido”** exibidos na imagem.

## Correção

1. Tornar a associação de campos consciente do tipo:
   - blocos de alunos somente poderão apontar para campos do tipo **N Filhos**;
   - campos internos automáticos não participarão do pareamento visual;
   - campos comuns serão associados por nome e tipo, evitando colisões futuras.
2. Reforçar a renderização: se um bloco de alunos estiver ligado a um campo inválido ou numérico, ele localizará automaticamente o campo **N Filhos** do formulário antes de ler os dados.
3. Corrigir a troca do formulário de referência na pré-visualização, remapeando imediatamente todos os blocos para os campos correspondentes do formulário escolhido.
4. Corrigir os dados já salvos:
   - ajustar o template **Impressão Interactivo** da biblioteca;
   - atualizar todos os formulários associados para apontarem ao campo **N Filhos** correto;
   - eliminar referências quebradas que produzem “Campo removido”.
5. Validar com o cadastro **0001/BE2027** nas duas telas: pré-visualização do template e impressão pelo ícone da listagem. A lista deverá mostrar nome, nascimento, série e turno.

## Detalhes técnicos

- Ampliar `field_labels` para guardar também `type` e `internal`, mantendo compatibilidade com templates antigos.
- Atualizar `mapFieldsByLabel`, `remapLayoutFields` e `childrenOf` para validar o tipo do campo.
- Na biblioteca, remapear o layout quando `ref_form_id` mudar, em vez de apenas trocar a lista disponível no editor.
- Fazer uma correção pontual dos registros existentes na base externa após atualizar a lógica.

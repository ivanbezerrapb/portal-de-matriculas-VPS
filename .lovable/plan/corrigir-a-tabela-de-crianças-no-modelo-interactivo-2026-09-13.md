# Corrigir a tabela de crianças no modelo Interactivo

## O que está acontecendo

Ao imprimir uma ficha com o modelo **Impressão Interactivo**, o espaço da tabela de crianças sai em branco (conforme a seta na imagem), enquanto no modelo **Impressão Conecta** ela aparece normalmente.

Verificação feita no banco: cada modelo guarda uma lista de campos usados. Na lista do modelo Interactivo do formulário "Registro de Visitas 2027 (Novatos)" o campo de crianças desse formulário **não está incluído** — ele veio da lista de outro formulário quando o template foi aplicado. Como a tela de impressão só carrega os campos dessa lista, o bloco de crianças não encontra nenhum campo de crianças e sai vazio.

(Também notei que essa lista está com os campos repetidos duas vezes, efeito de aplicar o template mais de uma vez.)

## Correção

1. A tela de impressão passa a conhecer **todos** os campos do formulário, não só os da lista salva no modelo. Assim o bloco de crianças sempre encontra o campo correto do formulário do cadastro. O formato antigo (sem layout montado) continua respeitando a ordem/seleção da lista.
2. Ao aplicar um template a um formulário, a lista de campos passa a ser **remapeada para os campos daquele formulário e sem repetições**, incluindo o campo de crianças.
3. Limpeza dos modelos já existentes: corrigir a lista de campos dos 4 modelos gravados para apontar para os campos do próprio formulário, sem duplicatas.

Depois disso, a impressão volta a exibir a tabela com Nome, Nascimento, Série e Turno em todos os modelos.

## Detalhes técnicos

- `src/lib/ext/impressao.functions.ts` (`getPrintData`): retornar `fields` (ordenados/filtrados por `field_ids`, como hoje) e também `allFields` com todos os campos do formulário.
- `src/routes/_authenticated/imprimir.$templateId.tsx`: montar o `PrintContext` com `allFields`; o bloco legado continua usando `fields`.
- `src/components/print/PrintPreviewDialog` (pré-visualização no editor): mesma troca, garantindo consistência entre preview e impressão.
- `src/lib/ext/templates.functions.ts` (`applyTemplateToForm`) e `saveFormTemplateAsLibrary`: gerar `field_ids` a partir do mapeamento por rótulo dos campos do formulário de destino, deduplicado.
- Correção de dados nos 4 registros de `print_templates` (atualização de `field_ids`).

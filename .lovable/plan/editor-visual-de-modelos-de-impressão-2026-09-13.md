# Editor visual de modelos de impressão

Hoje o modelo de impressão só permite escolher título, campos e algumas opções fixas. Vou substituir isso por um editor de arrastar e soltar, onde você monta a folha exatamente como quiser.

## O editor

Uma folha A4 (ou A5) em branco na tela, com régua e grade. Você adiciona blocos e arrasta para onde quiser, redimensionando pelos cantos.

Blocos disponíveis:

- **Texto fixo** — qualquer texto seu (títulos, termos, declarações), com tamanho, negrito/itálico, alinhamento e cor.
- **Dado do cadastro** — insere o valor preenchido (nome, celular, e-mail, etc.), opcionalmente com o rótulo antes. Inclui o número da ficha, a escola e a data/hora do cadastro.
- **Imagem** — você envia a imagem do computador dentro do próprio editor (logo da escola, por exemplo).
- **Tabela** — número de linhas e colunas à sua escolha, com cabeçalho cinza, largura por coluna e células que podem ter texto fixo, um dado do cadastro ou ficar em branco para preenchimento à mão (como as tabelas de "Observação da Direção" do seu modelo).
- **Caixa / moldura** — retângulo com borda, para agrupar informações (como o quadro "Nº da ficha / Status matrícula / Situação").
- **Linhas para preencher à mão** — várias linhas pontilhadas em sequência.
- **Linha de assinatura** — traço com legenda embaixo.
- **Lista de crianças** — bloco especial que repete automaticamente cada criança do campo "N Filhos" (nome, nascimento, série, turno), em lista ou tabela.

Outros recursos: várias páginas por modelo (adicionar, reordenar, remover), duplicar e apagar blocos, alinhamento à grade, desfazer pela remoção e pré-visualização com dados reais antes de salvar.

## Impressão direta na listagem

Na listagem de cadastros, cada linha ganha um ícone de impressora. Ao clicar:

- se o formulário tiver um único modelo, abre imediatamente uma nova janela com a pré-impressão daquele cadastro;
- se tiver mais de um, aparece uma lista rápida para escolher e então abre a janela.

A impressão em lote pelos checkboxes continua funcionando, usando o mesmo layout.

## Seu modelo anexado

O editor tem todos os blocos necessários para reproduzir o PDF da Conecta Smart School (cabeçalho com logo, quadro de status, dados do responsável, quadro de alunos, perguntas, termo, assinatura e a segunda página com as tabelas de observação). Conforme você pediu, entrego o editor em branco e você monta.

## Detalhes técnicos

- `print_templates` ganha uma coluna `layout jsonb` (páginas → blocos com `x`, `y`, `w`, `h` em mm e propriedades por tipo). Campos antigos (`title`, `columns`, `field_ids`…) permanecem para compatibilidade: modelos sem `layout` continuam imprimindo no formato atual.
- Bucket público `print-assets` no Supabase externo, com política de leitura pública e escrita para autenticados; upload feito pelo cliente do usuário.
- Novo `src/components/print/` com `LayoutCanvas` (arrasto/redimensionamento via ponteiro, sem dependência nova), `BlockInspector` e `renderBlock`, este último compartilhado entre editor e página de impressão para o resultado ser idêntico.
- `formularios_.$formId.tsx` → aba "Modelos de impressão" abre o editor; `savePrintTemplate` passa a aceitar `layout`.
- `imprimir.$templateId.tsx` renderiza pelo layout quando existir, com `@page` no tamanho escolhido, quebra de página por página do modelo e posicionamento absoluto em mm.
- `cadastros.tsx` ganha o ícone de impressora por linha, usando `listPrintTemplates` filtrado pelo formulário do cadastro e `window.open` para a pré-impressão.

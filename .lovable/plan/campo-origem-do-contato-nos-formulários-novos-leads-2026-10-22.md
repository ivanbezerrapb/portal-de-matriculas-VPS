# Campo "Origem do contato" nos formulários Novos Leads

## O que muda
- Nos 4 formulários Novos Leads (Centro, Cristo, Bessa e Expedicionários), entra a pergunta **"Origem do contato:"** logo depois de **Telefone** e antes de **Série de Interesse**.
- Escolha de uma opção só, obrigatória: **Telefone**, **Contato**, **Site**, **Rede social**.
- Os links publicados continuam os mesmos. O campo passa a valer para os novos envios. Os LEADS antigos ficam sem essa informação.
- A resposta aparece na visualização do cadastro e nos "Dados do cliente" do cartão, como as outras perguntas.
- O campo pode ser editado depois em Formulários, como qualquer outro.

## Detalhes técnicos
- Inserir em `form_fields` (banco externo, via `extAdmin`) um campo `single_choice` (ou o tipo de escolha única existente) com `position` = 2, `required` = true e as 4 opções, nos 4 formulários `list_type = 'leads'`. Antes disso, deslocar `position` da Série de Interesse para 3.
- Conferir se a resposta aparece no formulário público e no cadastro abrindo um dos links.

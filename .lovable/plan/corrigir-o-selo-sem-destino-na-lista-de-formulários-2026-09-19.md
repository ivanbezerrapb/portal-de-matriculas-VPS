# Corrigir o selo "Sem destino" na lista de Formulários

## O que está errado

Todos os formulários aparecem com o selo "Sem destino", mesmo quando o envio para o CRM está ativado (confirmado no banco: os 4 formulários têm destino salvo e ativado).

## Causa

A lista lê o destino esperando uma lista de registros, mas o banco devolve um único registro por formulário (cada formulário tem no máximo um destino). Como o formato não bate, a tela conclui que não existe destino.

## Correção

- Na lista de Formulários, aceitar o destino tanto como registro único quanto como lista, e usar o valor de "ativado" encontrado.
- Resultado: cada card mostra "Envio ativado" (verde) ou "Envio desativado" (cinza); "Sem destino" só aparece quando o formulário realmente nunca teve destino salvo.

## Detalhes técnicos

- `src/routes/_authenticated/formularios.tsx` (linhas 151–152): normalizar `f.form_destinations` com `Array.isArray(raw) ? raw[0] : raw` e derivar `destEnabled = row ? row.enabled : null`.
- Sem alteração no banco, nas consultas do servidor ou nas permissões.

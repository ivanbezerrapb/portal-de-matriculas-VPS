# Alerta de restrição na Lista de Visitantes

## O que muda

Quando um cadastro responder **"Sim"** à pergunta *"Atualmente possui algum acompanhamento médico, psicológico ou psicopedagógico?"* (em qualquer formulário que tenha essa pergunta):

1. **Ícone de alerta na listagem** — um triângulo com exclamação laranja aparece ao lado do ID do visitante, com dica ao passar o mouse: "Atenção: cadastro com acompanhamento médico/psicológico informado".
2. **Confirmação ao associar a um funil** — ao escolher um funil para esse cadastro, abre uma janela de atenção antes de enviar:
   - Título: "Atenção — cadastro com restrição"
   - Texto explicando que o visitante informou acompanhamento médico/psicológico/psicopedagógico e que ele só deve ir para um funil após avaliação.
   - Botões: **Cancelar** e **Sim, incluir no funil**.
   - Só ao confirmar o cartão é criado (seguindo o fluxo atual: 1ª etapa, tarefa de 1º contato, responsável do funil; se o funil tiver mais de um responsável, a janela de "Quem atendeu?" continua aparecendo depois da confirmação).
3. Cadastros sem essa pergunta, ou que responderam "Não"/em branco, seguem exatamente como hoje — sem ícone e sem janela extra.

## Detalhes técnicos

- `src/lib/ext/cadastros.functions.ts` → `listSubmissions`: além do campo de nome do responsável, localizar em `form_fields` os campos cujo rótulo normalizado contenha "acompanhamento" e ("medico" ou "psicolog" ou "psicopedag"); buscar esses valores em `submission_values` (`part = ""`) para os cadastros da página e devolver `restricted: boolean` em cada linha (verdadeiro quando o valor normalizado for "sim"). Reaproveita a função `norm` já existente e a mesma consulta de valores (basta ampliar `fieldIds`), sem consulta extra pesada.
- `src/routes/_authenticated/cadastros.tsx`:
  - Importar `AlertTriangle` de `lucide-react` e renderizar o ícone (classe de cor laranja/âmbar do tema, `title` + `aria-label`) junto ao `public_id` quando `s.restricted`.
  - Em `pickFunnel`, quando a linha for `restricted` e houver funil escolhido, guardar a intenção em um estado (`confirmRestricted`) e abrir o diálogo de confirmação em vez de enviar direto; ao confirmar, seguir para o fluxo atual (envio direto ou diálogo "Quem atendeu?").
- Sem alteração no banco de dados, nas permissões ou nos cálculos dos indicadores.

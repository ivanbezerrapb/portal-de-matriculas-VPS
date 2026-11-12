# Sinalizar pendência pedagógica no cartão do Pipeline

- Nos cartões do CRM › Pipeline (Visitantes e LEADS), quando o cadastro tiver pendência pedagógica (acompanhamento médico, psicológico ou psicopedagógico = "Sim"), aparece o mesmo triângulo laranja com exclamação usado na lista, no canto direito do cartão.
- Ao passar o mouse, mostra "Pendência pedagógica — atenção".
- Vale para todos que veem o Pipeline. Nada muda nas regras de movimentação.

## Detalhes técnicos
- Extrair a detecção de pendência usada em `listSubmissions` (cadastros.functions.ts) para um helper reutilizável.
- Em `listPipeline`, calcular `restricted` para os `submission_id` dos cartões e retornar no card.
- Em `crm.pipeline.tsx`, renderizar o ícone `AlertTriangle` laranja (mesmo estilo da lista) quando `card.restricted`.

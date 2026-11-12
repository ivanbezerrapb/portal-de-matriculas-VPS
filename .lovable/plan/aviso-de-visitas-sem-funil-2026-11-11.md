# Aviso de visitas sem funil

## O que muda
- Novo aviso em pop-up para **Secretarias e Gerentes** (mesmo público do aviso do Calendário) quando houver cadastros da **Lista de Visitantes** da unidade delas **sem funil**.
- Ficam de fora:
  - fichas com pendência pedagógica (triângulo laranja);
  - cadastros já matriculados;
  - cadastros da Lista de LEADS.
- O aviso lista cada visita (ID, nome, data, séries) e permite **escolher o funil ali mesmo**, com as mesmas regras da lista: só funis Pós Visita da unidade, responsável preenchido automaticamente e escolha do responsável quando houver mais de um.
- Também tem o botão **Lembrar depois**, que esconde por 1 hora, e um selo com o total no menu Lista de Visitantes.
- Se os dois avisos tiverem pendências, primeiro aparece o do Calendário. O aviso de visitas sem funil aparece depois que o primeiro for resolvido ou adiado.
- A lista de pendências do aviso é atualizada a cada 1 hora (e logo após cada associação feita no próprio aviso).

## Detalhes técnicos
- Novo componente `PendingFunnelDialog.tsx` usando `listSubmissions` (list_type visitors) e filtrando `!attendant/funil && !restricted && !enrolled`. A permissão de envio fica no servidor.
- Reaproveita `sendSubmissionToFunnel` e `listFunnels` filtrado por `funnelListType === "visitors"` e pela escola.
- Chave própria no localStorage para adiar (1h). É montado em `_authenticated/route.tsx` com a mesma condição `attendanceAlert`.

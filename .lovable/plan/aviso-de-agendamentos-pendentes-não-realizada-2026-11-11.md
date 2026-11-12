# Aviso de agendamentos pendentes (Não realizada)

Ótima ideia: resolver tudo direto no aviso, sem precisar procurar no calendário.

## Como vai funcionar
- Quem vê: **Secretaria e Gerente**, só da própria unidade (os mesmos que já marcam Compareceu/Faltou).
- Quando aparece: ao entrar no portal e a cada 30 segundos, se existir visita ou matrícula de **dias anteriores** sem Compareceu/Faltou (status "Não realizada").
- A janela lista todos esses agendamentos, do mais antigo ao mais recente, com: data/hora, tipo (Visita ou Matrícula), ID + nome, série, telefone com WhatsApp.
- Em cada linha, dois botões: **Compareceu** (verde) e **Faltou**. Eles fazem exatamente o que os botões do calendário já fazem hoje (ganho do cartão, conclusão de tarefas, Histórico, mudança de etapa; ou Reagendar visita/matrícula). Matrícula ao clicar Compareceu continua pedindo a quantidade.
- Cada item resolvido sai da lista na hora; quando acabar, a janela fecha sozinha com mensagem "Tudo em dia".
- Botão **Lembrar depois**: fecha a janela; ela volta após 30 minutos (ou ao recarregar a página) enquanto houver pendências.
- Um selo vermelho com a quantidade de pendências aparece no menu Calendário.

## Detalhes técnicos
- Nova server function `listPendingAttendance` em `calendario.functions.ts`, reaproveitando a lógica de `listCalendarEvents` e filtrando `status === "missed"` dentro das permissões de ação (Secretaria/Gerente da unidade).
- Componente `PendingAttendanceDialog` montado no layout `_authenticated`, com `useQuery` (refetch 30s) e soneca guardada em localStorage.
- Botões chamam as funções já existentes de check-in/matrícula e Faltou; após sucesso, invalida queries do calendário, pipeline e listas.

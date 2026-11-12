# MAXBOT com duas contas: Conecta e Interactivo

## O que o usuário verá
- A tela **Configurações › MAXBOT** passa a ter dois blocos lado a lado (um embaixo do outro em telas estreitas): **Conecta** e **Interactivo**.
- Cada bloco tem tudo próprio e independente:
  - Token da API (com olho; depois de salvo mostra só "Token configurado", com opção de trocar ou remover).
  - Endereço da API (já preenchido).
  - Integração ativa (liga/desliga).
  - Botões **Salvar** e **Testar conexão**.
  - Última alteração (quem e quando) e último teste.
- Salvar ou testar uma conta não mexe na outra. O Log de Registro informa qual conta foi alterada ou testada ("Maxbot Conecta" / "Maxbot Interactivo").
- A configuração já salva hoje (se houver) é tratada como **Conecta**; o Interactivo começa vazio.

## Uso futuro
Cada envio de mensagem vai usar a conta da marca da escola do lead (Centro e Expedicionários → Conecta; Cristo e Bessa → Interactivo), igual à divisão da Central de Arquivos.

## Detalhes técnicos
- Arquivo privado passa a guardar `{ conecta: {...}, interactivo: {...} }`; leitura converte o formato antigo (objeto único) para `conecta`.
- Server functions recebem `account: "conecta" | "interactivo"` (zod enum); `getMaxbotSettings` devolve as duas visões públicas, sem token.
- Tela renderiza um componente `AccountCard` por conta, com estado próprio.

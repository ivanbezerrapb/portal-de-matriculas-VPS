# Alterar a numeração da Lista de LEADS

## Resultado esperado

Os LEADS continuarão em uma sequência própria por unidade, mas o ID passará a incluir o prefixo da escola:

- Centro: `1001/CE2027`
- Cristo: `2001/CR2027`
- Bessa: `3001/BE2027`
- Expedicionários: `4001/EX2027`

A Lista de Visitantes continuará usando sua numeração atual, sem nenhuma alteração.

## Implementação

1. **Atualizar a geração dos IDs de LEADS**
   - Manter o contador exclusivo de LEADS de cada unidade.
   - Gerar o ID com o próximo número, uma barra e o prefixo já configurado na escola.
   - Exemplos seguintes: `1002/CE2027`, `2002/CR2027`, `3002/BE2027` e `4002/EX2027`.

2. **Preservar os dados atuais**
   - Manter todos os formulários existentes na Lista de Visitantes.
   - Não alterar a geração dos IDs dos visitantes.
   - Não será necessária conversão: a conferência atual mostrou que ainda não há LEADS cadastrados.

3. **Atualizar a configuração do projeto**
   - Registrar o mesmo formato na função do banco externo e no script de configuração, evitando diferenças futuras entre ambientes.

4. **Validar**
   - Criar um LEAD de teste para cada unidade e conferir o ID na confirmação, Lista de LEADS, detalhes, impressão e CRM.
   - Confirmar que um novo visitante continua recebendo o formato atual da Lista de Visitantes.

## Detalhes técnicos

- Alterar somente `next_school_lead_id(uuid)` para retornar `lead_next_number || '/' || id_prefix`.
- Preservar os contadores atuais: Centro `1001`, Cristo `2001`, Bessa `3001` e Expedicionários `4001`.
- A coluna `public_id` já aceita texto e continuará garantindo IDs únicos.
# Alterar o formato do ID dos cadastros

## Resultado esperado

Os identificadores passarão do formato `CENTRO-0001` para `0001/CENTRO`, com o número antes do prefixo e uma barra como separador.

## Implementação

1. **Atualizar a geração de IDs**
   - Alterar a função que reserva o próximo número de cada escola para retornar `número/prefixo`.
   - Preservar a quantidade de dígitos configurada e a sequência individual de cada escola.
   - Exemplo: prefixo `CENTRO`, 4 dígitos e próximo número `1` produzirá `0001/CENTRO`.

2. **Converter os cadastros existentes**
   - Atualizar os IDs atuais de `PREFIXO-NÚMERO` para `NÚMERO/PREFIXO`.
   - Converter apenas valores no padrão anterior esperado, sem alterar identificadores fora desse padrão.
   - Manter a unicidade dos IDs e não reiniciar os contadores das escolas.

3. **Atualizar os exemplos da interface**
   - Trocar os exemplos exibidos na configuração das escolas e na busca de cadastros.
   - A listagem, os detalhes e as impressões já usam o ID armazenado e refletirão automaticamente o novo formato.

4. **Validar o fluxo**
   - Confirmar a conversão de IDs existentes.
   - Criar um cadastro de teste e verificar o novo formato na confirmação, listagem, detalhes, busca e impressão.

## Detalhes técnicos

- Atualizar a função `next_school_public_id` no banco externo e no script de configuração do projeto.
- Executar a atualização dos dados existentes separadamente da alteração estrutural da função.
- Validar previamente possíveis conflitos de unicidade antes da conversão.

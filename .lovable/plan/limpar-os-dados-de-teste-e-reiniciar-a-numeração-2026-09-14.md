# Limpar os dados de teste e reiniciar a numeração

## O que será apagado

Hoje existem 15 cadastros de teste distribuídos assim: Centro 9, Cristo 3, Bessa 2, Expedicionários 1.

Serão removidos:

- Os 15 cadastros e todas as respostas dos formulários (135 registros)
- As 9 oportunidades do CRM (vindas de cadastro e criadas manualmente) e suas 9 tarefas
- Os 7 nomes de Atendimento (Secretaria) e Apresentação (Coordenação)
- O histórico de alterações desses cadastros (26 registros)

## O que será mantido

Escolas, formulários e campos, funis e etapas, motivos de perda, modelos de impressão, templates e usuários — nada disso é apagado.

## Numeração dos IDs

O contador de cada unidade volta para 1, respeitando o prefixo e a quantidade de dígitos já configurados. O próximo cadastro de cada unidade sairá assim:

- Centro: 0001/CE2027
- Cristo: 0001/CR2027
- Bessa: 0001/BE2027
- Expedicionários: 0001/EX2027

## Conferência depois da limpeza

- Lista de cadastros vazia
- Pipeline e Tarefas do CRM vazios
- Tela Início zerada (visitas, crianças, matrículas, séries, origens e motivos de perda)
- Confirmar que o próximo cadastro real recebe o número 0001 da sua unidade

## Detalhes técnicos

- Execução na base externa: `DELETE` em `submission_values`, `crm_tasks`, `opportunities`, `audit_log` (registros dos cadastros), `submissions` e `presenters`, na ordem de dependência.
- `UPDATE schools SET id_next_number = 1` para as 4 unidades; `id_prefix` e `id_digits` permanecem inalterados.
- Operação irreversível — não há cópia de segurança desses dados de teste.

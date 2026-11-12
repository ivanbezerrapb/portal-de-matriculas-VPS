# Preencher o Atendimento automaticamente ao escolher o funil

## O que será feito

1. **Vincular os responsáveis aos funis** — hoje nenhum funil tem responsável da Central de Informações vinculado, por isso o cartão é criado sem nome no Atendimento. Será vinculado o usuário **Central Conecta** aos funis das unidades Conecta:
   - Centro - Pós Visita
   - Centro - Pós Visita (Fund II e Médio)
   - Expedicionários - Pós Visita

2. **Confirmar o comportamento automático** (já existente no sistema):
   - Funil com **1 responsável** → o nome entra direto na coluna Atendimento, sem perguntar.
   - Funil com **mais de 1 responsável** → abre a janela "Quem atendeu?" para escolher, e o cartão é criado no funil com o responsável informado.
   - Funil **sem responsável** → o cartão é criado e o Atendimento fica em branco (pode preencher depois).

3. **Reprocessar o cadastro 0003/CE2027** — como ele já foi enviado ao funil sem responsável, ao confirmar este plano o Atendimento dele será preenchido com "Central Conecta" (único responsável do funil escolhido).

## Regras mantidas

- O vínculo respeita as unidades: só é possível vincular funis das unidades que o usuário atende.
- Secretaria, Gerente e Administrador continuam podendo escolher o funil, sempre na unidade do lead.

## Detalhes técnicos

- Inserir vínculos na tabela `user_funnels` (user_id da Central Conecta × os 3 funis Conecta).
- Atualizar `submissions.attendant_id` do cadastro 0003/CE2027 via `presenters` (kind `secretaria`, escola Centro), reutilizando a mesma regra do envio ao funil.
- Nenhuma alteração de código é necessária — o comportamento automático e a janela de escolha já estão implementados; o que faltava era o vínculo dos responsáveis.

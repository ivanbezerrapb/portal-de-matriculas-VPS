# Importar contatos do Maxbot (por Segmentação) para a Lista de LEADS

## Como vai funcionar
Na tela **Configurações › MAXBOT**, cada conta (Conecta e Interactivo) ganha a seção **Importação de LEADS**:

- **Etiqueta por unidade**: para cada unidade da conta, você escolhe a Segmentação do Maxbot que corresponde a ela (lista carregada direto do Maxbot).
  - Conecta: Centro e Expedicionários. Interactivo: Cristo e Bessa.
- **Buscar contatos a partir de**: você escolhe a data inicial na tela. O portal só olha contatos cadastrados no Maxbot desde essa data.
- **Importação automática** (liga/desliga): a cada 15 minutos o portal busca os contatos da conta, encontra os que têm a etiqueta de uma unidade e cadastra os novos na **Lista de LEADS** daquela unidade.
- Botão **Importar agora** para rodar na hora, e um resumo da última execução (quantos encontrados, importados e já existentes).

## Como o lead entra
- Recebe o próximo ID da unidade (ex.: 1012/CE2027), igual a um lead do formulário.
- Preenche nome, WhatsApp/telefone e e-mail com os dados do Maxbot. O campo **Origem do contato** fica como "Maxbot".
- Fica vinculado ao formulário **Novos Leads** da unidade, então aparece na lista, impressão e filtros como qualquer lead. O envio ao funil segue a regra que já existe hoje.
- **Sem duplicar**: um contato do Maxbot é importado uma única vez, mesmo se continuar com a etiqueta. Se o mesmo WhatsApp já estiver na Lista de LEADS da unidade, ele também não é importado de novo.
- Cada importação aparece no Log de Registro.

## Limitação do Maxbot
A API não filtra por etiqueta, então o portal lê todos os contatos do período (100 por página) e separa pelas etiquetas. Datas muito antigas deixam a primeira importação mais lenta.

## Detalhes técnicos
- Config por conta no arquivo privado existente: `segmentations: { [schoolId]: segmentationTitle }`, `import_since`, `import_enabled`, `last_import`.
- Server fns admin: `listMaxbotSegmentations(account)` (cmd `get_segmentation`, type 0), `saveMaxbotImport`, `runMaxbotImport(account)`.
- Núcleo `maxbot.server.ts`: pagina `get_contact` (`date_start`=import_since, `date_stop`=hoje, `per_page` 100), filtra `segmentation` contendo o título mapeado, cria submission `list_type='leads'` via `next_school_lead_id` + `submission_values` mapeados por rótulo do campo do formulário Novos Leads da escola.
- Deduplicação: nova tabela `maxbot_imports(account, contact_id, submission_id, school_id, created_at)` com unique (account, contact_id), mais checagem do telefone; trigger de log.
- Agendamento: rota `src/routes/api/public/maxbot-import.ts` protegida por segredo gerado, chamada a cada 15 min pelo agendador do banco; roda as contas com importação ativa.

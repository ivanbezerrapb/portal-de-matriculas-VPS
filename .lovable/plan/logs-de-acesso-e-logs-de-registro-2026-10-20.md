# Logs de Acesso e Logs de Registro

Dois novos itens em **Configurações**, logo abaixo de **Bancos anteriores**, visíveis só para Administrador.

## 1. Log de Acesso
- **Resumo por usuário:** nome, e-mail, perfil, unidade(s), **último acesso**, total de acessos nos últimos 30 dias e situação: *Acessou hoje*, *Acessou nos últimos 7 dias*, *Sem acesso há mais de 7 dias*, *Nunca acessou*.
- **Histórico de eventos:** cada entrada no portal (login), saída (logout), tentativa de login com senha errada e cada abertura do portal com sessão já ativa (no máximo 1 registro a cada 30 min por usuário), com data/hora e navegador/dispositivo.
- Filtros: usuário, perfil, situação, tipo de evento e período. Busca por nome/e-mail. Paginação.
- O histórico começa a contar a partir da publicação; o "último acesso" de antes disso vem do registro de login já existente de cada usuário.

## 2. Log de Registro
- Registra automaticamente **toda criação, alteração e exclusão** feita no sistema: cadastros (Visitantes e LEADS), check-in, matrícula, cartões do CRM (mover etapa, responsável, data de visita, ganho/perda), tarefas, histórico do cartão, formulários e publicação, destinos, templates, escolas, funis/etapas, usuários e permissões, atividades, motivos, Central de Arquivos e Bancos anteriores.
- Cada linha mostra: data/hora, usuário, ação (Criou / Alterou / Excluiu), área (ex.: "Pipeline"), o item (ex.: "4001/EX2027 · Maria") e um botão para ver **o que mudou** (valor antes → depois, campo a campo).
- Filtros: usuário, área, ação, unidade e período. Busca livre. Paginação.
- Os registros não podem ser editados nem apagados por ninguém pelo portal.

## Detalhes técnicos
- Banco externo: tabelas `access_logs` (user_id, event, user_agent, created_at) e `activity_logs` (actor_id, actor_name, action, table_name, record_id, school_id, label, old_data, new_data, created_at), com GRANT, RLS só leitura para `has_role(admin)`, sem update/delete.
- `activity_logs` alimentada por uma função de trigger genérica `log_activity()` (SECURITY DEFINER, usa `auth.uid()`; ignora colunas técnicas como updated_at) aplicada em AFTER INSERT/UPDATE/DELETE nas tabelas de negócio. Mudanças feitas pelo servidor com chave administrativa passam o autor via `set_config('app.actor_id', ...)` numa RPC auxiliar; quando ausente, aparece "Sistema".
- `access_logs`: `auth.tsx` grava login/falha via server function; `route.tsx` grava abertura de sessão (com intervalo de 30 min) e logout. Último acesso/nunca acessou via `auth.admin.listUsers` (`last_sign_in_at`).
- Server functions em `src/lib/ext/logs.functions.ts` (requireAuth + verificação admin); rotas `_authenticated/logs-acesso.tsx` e `_authenticated/logs-registro.tsx` com `head()` próprio; itens adicionados ao grupo Configurações em `route.tsx`; `supabase-setup.sql` atualizado.
- Retenção: sem exclusão automática por enquanto.

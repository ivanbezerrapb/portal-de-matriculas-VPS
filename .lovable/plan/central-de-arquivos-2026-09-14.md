# Central de Arquivos

Nova área no menu para compartilhar arquivos com as equipes, separada por marca e por unidade.

## Menu

```text
CENTRAL DE ARQUIVOS
-- Conecta        (Centro e Expedicionários)
-- Interactivo    (Cristo e Bessa)
```

Cada pessoa só enxerga a(s) marca(s) das unidades a que está vinculada; o Administrador vê as duas.

## Como funciona

- **Ver e baixar**: todos os perfis (Administrador, Gerente, Secretaria e Central de Informações), limitado às unidades de cada um.
- **Enviar arquivos**: apenas Administrador e Gerente. O Gerente envia para toda a marca dele (ex.: Gerente do Centro envia para Conecta) ou para uma unidade específica da marca.
- **No envio escolhe-se**: marca inteira ou unidade específica, a categoria e o arquivo (pode enviar vários de uma vez).
- **Categorias**: definidas no envio (ex.: Documentos, Materiais, Comunicados). A lista mostra os arquivos agrupados/filtráveis por categoria.
- **Lista de arquivos**: nome, categoria, destino (marca ou unidade), tamanho, quem enviou e data, com botão Baixar.
- **Excluir**: Administrador pode excluir qualquer arquivo; Gerente só os da própria marca/unidade.
- Um arquivo enviado para "Conecta" aparece para Centro e Expedicionários; enviado para "Centro" aparece só para Centro.

## Detalhes técnicos

**Banco**
- `schools.brand text` com valores `conecta` / `interactivo`, preenchido: Centro e Expedicionários = conecta; Cristo e Bessa = interactivo.
- `public.file_categories` (id, brand, name, position, active) — categorias por marca, criadas na hora se o nome ainda não existir.
- `public.shared_files` (id, brand, school_id nullable, category_id nullable, name, path, mime_type, size_bytes, uploaded_by, created_at).
- GRANTs para `authenticated` e `service_role`; RLS: SELECT quando admin, ou quando a marca/unidade do arquivo bate com as unidades do usuário (`user_crm_school_ids`); INSERT/UPDATE/DELETE só admin ou `school_manager` da marca/unidade correspondente.

**Armazenamento**
- Bucket privado `central-arquivos` (criado pela ferramenta de storage), caminho `<brand>/<school_id|marca>/<uuid>-<nome>`.
- Políticas em `storage.objects` espelhando as regras acima; download por URL assinada gerada em server function.

**Aplicação**
- `src/lib/ext/arquivos.functions.ts`: `listFiles({ brand, school_id?, category_id? })`, `createFileRecord`, `getDownloadUrl`, `deleteFile`, `listFileCategories`, `createFileCategory` — todas com `requireAuth` + `getPerms`.
- Upload feito do navegador direto no bucket (cliente autenticado) e, em seguida, registro dos metadados pela server function.
- Rotas `src/routes/_authenticated/arquivos.conecta.tsx` e `arquivos.interactivo.tsx`, cada uma com `head()` próprio, reutilizando um componente comum de listagem/upload.
- `src/routes/_authenticated/route.tsx`: novo `NavGroup` "Central de Arquivos" com os dois filhos, exibidos conforme as marcas permitidas ao usuário, e `allowedPaths` atualizado.

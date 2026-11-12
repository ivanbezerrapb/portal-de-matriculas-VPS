# Links na Central de Arquivos

Além de enviar arquivos, Administrador e Gerente poderão cadastrar **links de acesso** (ex.: pasta do Drive, planilha, sistema), com a URL visível na lista.

## Como funciona

- No bloco de envio, duas opções: **Enviar arquivos** e **Adicionar link**.
- Ao adicionar um link informa-se: título, endereço (URL), destino (marca inteira ou unidade) e categoria — as mesmas regras do upload.
- A lista passa a mostrar arquivos e links juntos, com uma coluna **Tipo** (Arquivo / Link).
- No caso de link, a URL aparece visível e clicável (abre em nova aba) e pode ser copiada com um botão "Copiar".
- Excluir segue a mesma regra: Administrador em qualquer marca, Gerente na própria marca/unidade.
- Quem só visualiza (Secretaria e Central de Informações) vê e acessa os links das suas unidades, sem poder criar.

## Detalhes técnicos

**Banco**
- `shared_files`: novas colunas `kind text not null default 'file'` (check `file|link`) e `url text`; `path` passa a aceitar nulo para linhas de link (mantendo o índice único apenas quando preenchido).
- Validação: `kind='link'` exige `url`; `kind='file'` exige `path`.
- Sem mudança nas policies — as regras de marca/unidade já cobrem as novas linhas.

**Aplicação**
- `src/lib/ext/arquivos.functions.ts`: novo `createLinkRecord({ brand, school_id?, category_id?, name, url })` com as mesmas checagens de `createFileRecord`; `deleteFile` só remove do bucket quando `kind='file'`; tipos `SharedFile` ganham `kind` e `url`.
- `src/components/CentralArquivos.tsx`: formulário de link (título + URL) ao lado do envio de arquivos, coluna Tipo, exibição da URL com link externo e botão Copiar, e botão Baixar apenas para arquivos.
- Validação de URL no cliente e no servidor (precisa começar com `http://` ou `https://`).

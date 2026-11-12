# Ações da listagem de formulários em ícones

## O que muda

Na página **Formulários** (`src/routes/_authenticated/formularios.tsx`):

1. **Remover** os botões "Publicar" / "Encerrar" da listagem — essa ação continua disponível dentro da tela de configuração do formulário, onde já existe hoje.
2. **Transformar em ícones** (botões pequenos, só com ícone e dica ao passar o mouse):
   - **Configurar** — ícone de engrenagem (link para a configuração)
   - **Duplicar** — ícone de copiar (abre o diálogo atual de duplicação)
   - **Excluir** — ícone de lixeira (mantém a confirmação atual)
3. **Novo ícone de link** (corrente), visível **apenas quando o formulário está publicado**:
   - Ao clicar, copia o endereço de preenchimento público `https://<site>/f/<slug>` para a área de transferência.
   - Mostra a confirmação "Link copiado".

## Detalhes técnicos

- Ícones do `lucide-react`: `Settings`, `Copy`, `Trash2`, `Link`.
- Cada ícone recebe `title` e `aria-label` ("Configurar", "Duplicar", "Excluir", "Copiar link do formulário") para acessibilidade.
- Cópia com `navigator.clipboard.writeText(...)` + `toast.success("Link copiado.")`.
- Nenhuma mudança de banco ou de funções de servidor — apenas a listagem.

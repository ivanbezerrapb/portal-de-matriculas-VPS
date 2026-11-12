# Cópia do sistema no GitHub

## Ponto importante
A sincronização com o GitHub **não consegue usar um repositório que já existe** (como o `ivanbezerrapb/portal-matriculas-grupointer`). Ao conectar, ela cria sozinha um **repositório privado novo** na sua conta e mantém o código sempre atualizado, nos dois sentidos.

## Passos (feitos por você, eu não consigo conectar por aqui)
1. Abra **Configurações do projeto → Git** (ou o botão **+** ao lado do chat → Projeto → GitHub).
2. Clique em **Conectar GitHub** e autorize a conta `ivanbezerrapb`.
3. Escolha a conta e confirme: será criado um repositório privado com todo o código do portal.
4. Se quiser manter o nome `portal-matriculas-grupointer`, apague (ou renomeie) o repositório vazio atual no GitHub **antes** e depois renomeie o novo no GitHub — a sincronização continua funcionando após renomear.

## O que vai e o que não vai para o GitHub
- Vai: todo o código e configurações do portal.
- Não vai: os dados (cadastros, cartões, usuários) nem senhas e chaves secretas — eles continuam só no servidor.

## Alternativa
Se quiser apenas uma cópia avulsa: **Configurações do projeto → Git → Baixar código** e enviar o arquivo manualmente para o repositório existente (essa cópia não se atualiza sozinha).

Nenhuma alteração no sistema é necessária.

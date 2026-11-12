# Ações do usuário empilhadas à direita

## Como fica
- Os 5 comandos (Editar, Exigir/Cancelar troca de senha, Redefinir senha, + Perfil, Excluir) passam para uma **coluna estreita à direita do card**, um abaixo do outro, alinhados à direita.
- Botões compactos: texto pequeno, ícone discreto à esquerda (lápis, cadeado, chave, +, lixeira), pouco espaçamento vertical — a coluna fica com a altura do próprio card (nome, e-mail, selo, perfis e funis), sem aumentá-lo.
- **Excluir** fica por último, em vermelho.
- O nome e o e-mail ocupam o restante da largura e não ficam mais sobrepostos pelos botões.
- No celular a coluna continua à direita; se faltar espaço, desce para baixo das informações.

## Técnico
- `src/routes/_authenticated/usuarios.tsx`: card vira grade `grid-cols-[minmax(0,1fr)_auto]`; informações (nome, e-mail, selo, perfis, funis) na coluna 1; ações em `flex flex-col items-end gap-0.5` na coluna 2 com botões `h-7 px-2 text-xs` e ícones `lucide-react` (`Pencil`, `Lock`, `KeyRound`, `Plus`, `Trash2`). Painéis de edição/redefinir/adicionar perfil continuam abrindo abaixo, em largura total. Sem mudança de lógica.

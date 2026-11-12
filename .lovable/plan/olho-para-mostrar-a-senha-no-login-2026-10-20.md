# Olho para mostrar a senha no login

- Na tela de login, adicionar um ícone de olho dentro do campo **Senha**, à direita.
- Clicar no olho mostra a senha digitada; o ícone muda para olho riscado e, ao clicar de novo, a senha volta a ficar oculta.
- A senha começa sempre oculta.

## Detalhes técnicos

- `src/routes/auth.tsx`: estado `showPassword`, `type={showPassword ? "text" : "password"}`, botão `type="button"` com ícones `Eye`/`EyeOff` (lucide-react), `aria-label` "Mostrar senha"/"Ocultar senha", campo com `pr-10` dentro de um contêiner `relative`.

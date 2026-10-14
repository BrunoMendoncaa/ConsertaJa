# Modelos de e-mail (Supabase Auth)

Cole no painel do Supabase em **Authentication → Emails → Templates**:

| Modelo no Supabase | Assunto | Arquivo |
|---|---|---|
| Confirm signup | `Confirme seu cadastro no TecnoFix` | `confirmar-cadastro.html` |
| Reset password | `Redefinir sua senha do TecnoFix` | `redefinir-senha.html` |

Os outros modelos (Magic link, Invite, Change email) não são usados pelo sistema: os convites da equipe têm fluxo próprio e a troca de e-mail não existe na tela.

O link `{{ .ConfirmationURL }}` leva para `/auth/confirm` (fluxo PKCE), por isso deve ser aberto no mesmo navegador em que o pedido foi feito.

# Modelos de e-mail (Supabase Auth)

Cole no painel do Supabase em **Authentication → Emails → Templates**:

| Modelo no Supabase | Assunto | Arquivo |
|---|---|---|
| Confirm signup | `Confirme seu cadastro no TecnoFix` | `confirmar-cadastro.html` |
| Reset password | `Redefinir sua senha do TecnoFix` | `redefinir-senha.html` |

Os outros modelos (Magic link, Invite, Change email) não são usados pelo sistema: os convites da equipe têm fluxo próprio e a troca de e-mail não existe na tela.

**Confirm signup:** o botão usa `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`. O `/auth/confirm` confere o token no servidor, então o link funciona em qualquer navegador (a pessoa pode criar a conta no computador e confirmar no celular). O destino (cadastro da assistência ou o convite) vem do `redirect_to`. Para funcionar, o **Site URL** do Supabase (Authentication → URL Configuration) precisa ser `https://tecnofix.pro`.

**Reset password:** usa `{{ .ConfirmationURL }}` (fluxo PKCE), por isso deve ser aberto no mesmo navegador em que o pedido foi feito.

Os e-mails mandados pela área admin (reenviar confirmação e lembrar de cadastrar a assistência) não usam estes modelos: saem pelo próprio sistema, pela API do Resend (veja o README, "Área admin").

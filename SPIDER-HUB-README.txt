# Spider Websites: Discord authentication

Email/password sign-in remains available. The login and registration pages also offer Discord sign-in through Supabase Auth's official Discord OAuth provider; the client secret stays in Supabase's server-side provider configuration and is never shipped to browser code.

## Files changed
- `login/index.html` — added the responsive Discord sign-in button while preserving email/password login.
- `register/index.html` — added Discord account creation/sign-in while preserving email/password registration.
- `auth.css` — styles the Discord button and separator for the existing mobile-friendly theme.
- `auth.js` — calls Supabase Auth `signInWithOAuth` using provider `discord` and redirects back to the dashboard. OAuth exchange/session handling is performed by Supabase Auth.
- `dashboard/index.html` and `dashboard.js` — render the Discord account username and avatar from the authenticated Supabase user/provider metadata when available.

## Supabase setup required before it works
1. In Supabase Dashboard → Authentication → Sign In / Providers, enable Discord.
2. Enter the Discord application Client ID and Client Secret in Supabase's provider settings. Do not put the Client Secret in `config.js`, browser HTML, or JavaScript.
3. In Discord Developer Portal, add the Supabase Auth callback URL shown by the provider setup page to the OAuth2 redirect allowlist. Configure Discord email access if you want Supabase to receive verified email addresses.
4. In Supabase Auth URL Configuration, set the website Site URL and allow the deployed `https://YOUR-DOMAIN/dashboard/` redirect (plus local development URLs if needed).
5. Deploy the changed static website files and test a new Discord user and a returning user on desktop and Android.

This change uses Supabase Auth's supported OAuth flow rather than simulating Discord login. The existing `discord-oauth` Edge Function is still for linking/disconnecting Discord on a user who is already signed in; it is not used as a substitute for provider authentication. Linking an existing email/password identity to a Discord identity may require a separate explicit account-link flow; the sign-in button alone should not be represented as silently merging accounts. No live OAuth test was run here, and it will not work until the Supabase and Discord provider settings above are configured.

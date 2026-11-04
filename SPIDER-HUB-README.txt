# Spider Websites: Discord authentication

Email/password sign-in remains available. Login and registration also use Supabase Auth's official Discord OAuth provider (`discord`). The browser starts OAuth with the existing Supabase URL and publishable key from `config.js`; Supabase performs the authorization-code exchange and persists the session. No Discord client secret is exposed to website code.

## Supabase setup required
1. In Supabase Dashboard → Authentication → Sign In / Providers, enable Discord and configure the Discord application's Client ID and Client Secret there. Keep the secret in Supabase provider settings only.
2. In Discord Developer Portal, add the Supabase Auth callback URL shown by the provider settings page to the OAuth2 redirect allowlist.
3. In Supabase Auth URL Configuration, set the website Site URL and allow the deployed `https://YOUR-DOMAIN/dashboard/` redirect (plus local development URLs if needed).
4. Deploy the static website files and test a new Discord user and a returning user. Supabase creates/retrieves the OAuth identity and session; the dashboard then verifies the session with Supabase Auth.

## Files updated
- `auth.js` — starts Discord OAuth with provider `discord`, sets the dashboard return URL, handles Supabase OAuth errors, prevents repeated clicks, and preserves email/password signup/login.
- Login and registration pages already contain the Discord button and are unchanged by this update.

Discord OAuth settings are managed in Supabase. The separate `discord-oauth` Edge Function is for linking/disconnecting Discord on an already authenticated account; it is not used as a substitute for provider authentication. Automatic merging of separate email/password and Discord identities is not assumed. No live OAuth test was run here, and the flow depends on the Supabase and Discord provider settings above being completed.

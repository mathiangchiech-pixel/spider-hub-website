# Spider Websites: Discord OAuth, dashboard and owner controls

This update adds the account/dashboard UI and server-verified Discord OAuth plus owner-only plan and license management. It uses only this project's Supabase instance; it does not call LuaSecure services.

## Files added/changed
- `supabase/schema.sql` — profiles, subscription, scripts, license metadata, one-time OAuth state tables; RLS and read-only user policies; owner-check and state-consume SQL functions.
- `supabase/config.toml` — permits Discord's redirect callback to reach the OAuth function without a Supabase JWT; the function itself validates the one-time OAuth state.
- `supabase/functions/discord-oauth/index.ts` — authenticated OAuth start/disconnect, server-side Discord code exchange, identity lookup and profile linking. Discord access tokens are not stored.
- `supabase/functions/owner-admin/index.ts` — verifies Supabase JWT and `owner_accounts` on every request; supports user search/list, plan changes and license key create/revoke.
- `dashboard/index.html`, `dashboard.js` — responsive user dashboard with Discord link status, scripts, subscription, license metadata and logout.
- `owner/index.html`, `owner.js` — owner control panel with Discord-ID search, plan controls and key management.

## Required deployment setup
1. Run `supabase/schema.sql` in the Supabase SQL editor. Review it against any existing production schema before running it.
2. Deploy both functions: `supabase functions deploy discord-oauth` and `supabase functions deploy owner-admin`.
3. Set Edge Function secrets; never commit these values:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
   - `APP_URL` (the exact public website origin, e.g. `https://spiderhub.xyz`)
4. In the Discord Developer Portal, configure the OAuth2 redirect URI as `https://feltpayvtjzuxkdxkixy.supabase.co/functions/v1/discord-oauth`. Enable the `identify` scope only.
5. In Supabase Auth URL settings, allow your deployed dashboard URL and local dev URL as appropriate.
6. After registering your own user, add its UUID (from Supabase Auth → Users) as the sole authorized owner. Do this manually in the SQL editor; do not expose owner assignment in the website:
   `insert into public.owner_accounts (user_id) values ('YOUR-AUTH-USER-UUID');`
7. Keep RLS enabled. Normal accounts cannot write plans, owner records, OAuth state, or license keys. The owner Edge Function separately verifies owner authorization before every privileged action.

The `user_scripts` table is a safe metadata placeholder; no source upload/execution service is added. License keys are stored as SHA-256 hashes and only shown in full once to the owner at creation. A key hash alone does not provide key validation; implement a dedicated server-side validator before using these keys for access control. Use HTTPS in production and rotate credentials if any secret has ever been exposed.

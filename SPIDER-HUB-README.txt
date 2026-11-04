SPIDER HUB - CUSTOMIZED WEBSITE STARTER

This is a rebranded copy of the website files supplied in the conversation.
It is a FRONT-END STARTER, not a finished service.

Implemented in this update:
- email/password signup and login using the existing Supabase project
- logout and a Supabase-authenticated dashboard landing page
- mobile-friendly black, red and white account pages using Spider Hub branding
- signed-in visitors are redirected from the home page to the dashboard

Still not implemented/verified:
- secure server-side API and script upload/download
- license-key creation/validation
- Discord bot integration
- owner/admin permissions

Authentication requests go directly to your Supabase project. The old LuaSecure backend, API and database are NOT used. config.js contains the Supabase URL and public/publishable key only. Never put a Supabase secret/service_role key in public website files.

Before publicly distributing or commercially using the original package, verify that you have permission/license rights to modify and reuse its source files.

SUPABASE SETUP
1. In Supabase Authentication settings, enable the Email provider.
2. Set the Site URL to your deployed Spider Hub website origin.
3. Add the deployed origin and https://YOUR-DOMAIN/dashboard/ to the allowed redirect URLs. Also add your local development URL if needed.
4. Review whether email confirmation should be required. With confirmations enabled, new users will receive a confirmation email before completing sign-in.
5. Keep Row Level Security enabled and add appropriate policies before connecting private user data to the dashboard. A client-side route guard is not a substitute for database authorization.
6. Serve the website over HTTPS in production.

Auth pages use the Supabase JavaScript client from esm.sh and your existing public/publishable key in config.js. No secret key is sent to the browser.

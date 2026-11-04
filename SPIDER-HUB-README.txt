SPIDER HUB - CUSTOMIZED WEBSITE STARTER

This is a rebranded copy of the website files supplied in the conversation.
It is a FRONT-END STARTER, not a finished service.

Implemented:
- email/password signup, login and logout using the existing Supabase project
- Supabase-authenticated dashboard landing page
- mobile-friendly black, red and white account pages
- Spider Hub branding with a custom web emblem
- visible legacy LuaSecure labels are rendered as Spider Websites on site pages

The auth flow talks directly to your Supabase project. It does not use LuaSecure's servers, API, or database. config.js contains the Supabase URL and public/publishable key only. Never put a Supabase secret/service_role key in public website files.

The provided reference artwork could not be uploaded as a binary image with the available repository editor, so logo.svg is an original Spider Websites web emblem. Replace logo.svg with the reference image file (keeping the filename) to use the exact supplied art.

Before publicly distributing or commercially using the original package, verify that you have permission/license rights to modify and reuse its source files.

SUPABASE SETUP
1. In Supabase Authentication settings, enable the Email provider.
2. Set the Site URL to your deployed Spider Hub website origin.
3. Add the deployed origin and https://YOUR-DOMAIN/dashboard/ to the allowed redirect URLs. Also add your local development URL if needed.
4. Review whether email confirmation should be required. With confirmations enabled, new users will receive a confirmation email before completing sign-in.
5. Keep Row Level Security enabled and add appropriate policies before connecting private user data to the dashboard. A client-side route guard is not a substitute for database authorization.
6. Serve the website over HTTPS in production.

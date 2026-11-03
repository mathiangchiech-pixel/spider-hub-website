// Redirect returning users only from the landing page. Docs stay readable.
const cfg = window.LUASECURE_CONFIG || {};
if (location.pathname === '/' && !location.hash && cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const redirect = session => { if (session) location.replace('/dashboard/overview'); };
    const { data, error } = await client.auth.getSession();
    if (!error) redirect(data.session);
    client.auth.onAuthStateChange((_event, session) => redirect(session));
  } catch { /* A failed session check must not hide the public site. */ }
}

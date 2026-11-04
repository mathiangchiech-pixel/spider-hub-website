// Redirect signed-in visitors from the landing page to their account dashboard.
// Public pages and documentation remain available to everyone.
const cfg = window.SPIDER_HUB_CONFIG || {};
if (location.pathname === '/' && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY) {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const client = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    const redirect = session => { if (session) location.replace('/dashboard/'); };
    const { data, error } = await client.auth.getSession();
    if (!error) redirect(data.session);
    client.auth.onAuthStateChange((_event, session) => redirect(session));
  } catch { /* A failed session check must not hide the public site. */ }
}

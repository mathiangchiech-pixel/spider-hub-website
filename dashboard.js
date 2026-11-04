// A dashboard page is only shown after Supabase confirms the current user.
const config = window.SPIDER_HUB_CONFIG || {};
const dashboard = document.querySelector('[data-dashboard]');
const status = document.querySelector('[data-dashboard-status]');
const loginUrl = new URL('/login/', location.origin).href;

async function startDashboard() {
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    status.textContent = 'Supabase is not configured. Check config.js and add your project URL and publishable key.';
    return;
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      location.replace(loginUrl);
      return;
    }

    document.querySelector('[data-user-email]').textContent = user.email || 'Signed in';
    status.hidden = true;
    dashboard.hidden = false;
    supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') location.replace(loginUrl);
    });
    document.querySelector('[data-logout]').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Signing out…';
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        button.disabled = false;
        button.textContent = 'Log out';
        status.hidden = false;
        status.textContent = 'Could not sign out. Please try again.';
        return;
      }
      location.replace(loginUrl);
    });
  } catch {
    status.textContent = 'Could not connect to Supabase. Please refresh and try again.';
  }
}

startDashboard();

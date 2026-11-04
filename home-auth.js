// Lightweight Spider Websites homepage copy, button links and signed-in redirect.
// This file intentionally uses no MutationObserver or click interception: primary
// actions remain native links so mobile browsers can navigate without delay.
const config = window.SPIDER_HUB_CONFIG || {};
const DISCORD_INVITE = 'https://discord.gg/dVUtXEGGf';

function initializeHomepageActions() {
  if (location.pathname !== '/') return;

  const brand = document.querySelector('.nav .logo b');
  if (brand && brand.dataset.brandInitialized !== 'true') {
    brand.textContent = 'Spider Web';
    brand.dataset.brandInitialized = 'true';
  }

  const heading = document.querySelector('.hero h1');
  const description = document.querySelector('.hero .lede');
  const actions = document.querySelector('.hero .hero-cta');

  if (heading && heading.textContent.trim() !== 'Welcome to Spider Websites') {
    heading.replaceChildren(document.createTextNode('Welcome to Spider Websites'));
  }
  if (description && description.textContent.trim() !== 'Your home for premium scripts, secure license management and powerful tools. Join our community to stay updated!') {
    description.textContent = 'Your home for premium scripts, secure license management and powerful tools. Join our community to stay updated!';
  }

  if (actions && actions.dataset.actionsInitialized !== 'true') {
    const discord = document.createElement('a');
    discord.className = 'btn btn-primary btn-lg';
    discord.href = DISCORD_INVITE;
    discord.target = '_blank';
    discord.rel = 'noopener noreferrer';
    discord.textContent = 'Join Our Discord';

    const plans = document.createElement('a');
    plans.className = 'btn btn-ghost btn-lg';
    plans.href = '/pricing';
    plans.textContent = 'Explore Plans';

    actions.replaceChildren(discord, plans);
    actions.dataset.actionsInitialized = 'true';

    let note = document.querySelector('[data-community-note]');
    if (!note) {
      note = document.createElement('p');
      note.dataset.communityNote = '';
      note.style.cssText = 'margin-top:14px;color:var(--ink-3);font-size:13px';
      actions.insertAdjacentElement('afterend', note);
    }
    note.textContent = 'Get updates, announcements, support and news in our Discord community.';
  }

  // Keep the dashboard action a direct native navigation (including mobile).
  document.querySelectorAll('a[href="/dashboard"], a[href="/dashboard/"]').forEach(link => {
    link.setAttribute('href', '/dashboard/');
  });

  // Preserve the existing convenience redirect without blocking rendering or clicks.
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY || window.__spiderHomeSessionCheckStarted) return;
  window.__spiderHomeSessionCheckStarted = true;
  const checkSession = async () => {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const client = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      });
      const { data, error } = await client.auth.getSession();
      if (!error && data.session) location.replace('/dashboard/');
    } catch { /* Session lookup must never interfere with public page actions. */ }
  };
  if ('requestIdleCallback' in window) requestIdleCallback(checkSession, { timeout: 1800 });
  else setTimeout(checkSession, 700);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeHomepageActions, { once: true });
} else {
  initializeHomepageActions();
}

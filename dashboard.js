const config = window.SPIDER_HUB_CONFIG || {};
const dashboard = document.querySelector('[data-dashboard]');
const status = document.querySelector('[data-dashboard-status]');
const loginUrl = new URL('/login/', location.origin).href;
const plans = new Set(['Free', 'Basic', 'Premium', 'Pro', 'Enterprise']);

function safeText(value, fallback = '—') { return typeof value === 'string' && value ? value : fallback; }
function renderList(element, items, emptyText, renderer) {
  element.replaceChildren();
  if (!items?.length) {
    const li = document.createElement('li'); li.className = 'muted'; li.textContent = emptyText; element.append(li); return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    renderer(li, item);
    element.append(li);
  }
}
async function startDashboard() {
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) { status.textContent = 'Supabase is not configured. Check config.js.'; return; }
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) { location.replace(loginUrl); return; }

    const discordProvider = user.app_metadata?.providers?.includes('discord');
    const discordName = user.user_metadata?.global_name || user.user_metadata?.username || user.user_metadata?.full_name || user.email || 'Signed in';
    const discordAvatar = user.user_metadata?.avatar_url;
    const accountLabel = document.querySelector('[data-user-email]');
    accountLabel.textContent = discordProvider ? discordName : (user.email || 'Signed in');
    accountLabel.title = user.email || user.id;
    const avatar = document.querySelector('[data-user-avatar]');
    if (discordProvider && typeof discordAvatar === 'string' && /^https:\/\//.test(discordAvatar)) {
      avatar.src = discordAvatar;
      avatar.alt = `${discordName} Discord avatar`;
      avatar.hidden = false;
    }

    const discordStatus = document.querySelector('[data-discord-status]');
    const discordNameElement = document.querySelector('[data-discord-name]');
    const discordMessage = document.querySelector('[data-discord-message]');
    const connect = document.querySelector('[data-discord-connect]');
    const disconnect = document.querySelector('[data-discord-disconnect]');
    const { data: profile } = await supabase.from('profiles').select('discord_id,discord_username,discord_global_name,discord_avatar,discord_connected_at').eq('user_id', user.id).maybeSingle();
    const linkedDiscord = profile?.discord_id || (discordProvider ? user.user_metadata?.sub : null);
    const linkedName = profile?.discord_global_name || profile?.discord_username || discordName;
    const linkedAvatar = profile?.discord_avatar ? `https://cdn.discordapp.com/avatars/${profile.discord_id}/${profile.discord_avatar}.png` : discordAvatar;
    if (linkedDiscord) {
      discordStatus.textContent = 'Connected'; discordStatus.classList.add('status-good');
      discordNameElement.textContent = `${linkedName} · Discord ID ${linkedDiscord}`;
      connect.textContent = 'Reconnect Discord'; disconnect.hidden = false;
      if (typeof linkedAvatar === 'string' && /^https:\/\//.test(linkedAvatar)) {
        avatar.src = linkedAvatar; avatar.alt = `${linkedName} Discord avatar`; avatar.hidden = false;
      }
    }
    const params = new URLSearchParams(location.search);
    const discordResult = params.get('discord');
    const discordMessages = { connected: 'Discord was verified and linked to your Spider Websites account.', 'already-linked': 'That Discord account is already linked to another Spider Websites account.', 'invalid-state': 'Discord authorization expired or failed its security check. Please reconnect.', failed: 'Discord could not be connected. Please try again.' };
    if (discordMessages[discordResult]) { discordMessage.textContent = discordMessages[discordResult]; discordMessage.classList.toggle('status-good', discordResult === 'connected'); history.replaceState(null, '', location.pathname); }
    connect.addEventListener('click', async () => {
      connect.disabled = true; discordMessage.textContent = 'Opening Discord authorization…';
      const { data, error } = await supabase.functions.invoke('discord-oauth', { body: { action: 'start' } });
      if (error || !data?.url) { discordMessage.textContent = data?.error || 'Discord OAuth is not configured. Ask the site owner to finish server setup.'; connect.disabled = false; return; }
      location.assign(data.url);
    });
    disconnect.addEventListener('click', async () => {
      disconnect.disabled = true;
      const { data, error } = await supabase.functions.invoke('discord-oauth', { body: { action: 'disconnect' } });
      if (error || data?.error) { discordMessage.textContent = data?.error || 'Could not disconnect Discord.'; disconnect.disabled = false; return; }
      discordStatus.textContent = 'Not connected'; discordStatus.classList.remove('status-good');
      discordNameElement.textContent = 'Link your Discord account to connect it to your Spider Websites profile.';
      connect.textContent = 'Continue with Discord'; disconnect.hidden = true; disconnect.disabled = false;
      discordMessage.textContent = 'Discord was disconnected.';
    });

    const [{ data: subscription }, { data: scripts }, { data: licenses }, { data: ownerFlag }] = await Promise.all([
      supabase.from('user_subscriptions').select('plan,status,updated_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_scripts').select('id,name,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('license_keys').select('id,key_prefix,key_suffix,status,created_at,revoked_at').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.rpc('is_spider_owner')
    ]);
    const plan = plans.has(subscription?.plan) ? subscription.plan : 'Free';
    document.querySelector('[data-plan-badge]').textContent = plan;
    document.querySelector('[data-plan-status]').textContent = `Status: ${safeText(subscription?.status, 'active')}`;
    renderList(document.querySelector('[data-scripts]'), scripts, 'No scripts yet.', (li, script) => { li.textContent = `${safeText(script.name)} · ${safeText(script.status)}`; });
    renderList(document.querySelector('[data-licenses]'), licenses, 'No license keys yet.', (li, license) => {
      const label = document.createElement('span'); label.className = 'key-code'; label.textContent = `${safeText(license.key_prefix)}-••••-${safeText(license.key_suffix)}`;
      const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = safeText(license.status);
      li.append(label, badge);
    });
    if (ownerFlag?.data === true) document.querySelector('[data-owner-link]').hidden = false;
    status.hidden = true; dashboard.hidden = false;
    supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') location.replace(loginUrl); });
    document.querySelector('[data-logout]').addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true; button.textContent = 'Signing out…';
      const { error } = await supabase.auth.signOut();
      if (error) { button.disabled = false; button.textContent = 'Log out'; status.hidden = false; status.textContent = 'Could not sign out. Please try again.'; return; }
      location.replace(loginUrl);
    });
  } catch (error) { status.textContent = 'Could not connect to Supabase. Check the project setup and refresh.'; console.error(error); }
}
startDashboard();

const config = window.SPIDER_HUB_CONFIG || {};
const panel = document.querySelector('[data-owner-panel]');
const status = document.querySelector('[data-owner-status]');
const loginUrl = new URL('/login/', location.origin).href;
const dashboardUrl = new URL('/dashboard/', location.origin).href;
const plans = ['Basic', 'Premium', 'Pro', 'Enterprise'];
let supabase;
function report(text, good = false) { const el = document.querySelector('[data-owner-message]'); el.textContent = text; el.classList.toggle('good', good); }
function node(tag, text, className) { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }
async function adminAction(action, params = {}) {
  const { data, error } = await supabase.functions.invoke('owner-admin', { body: { action, ...params } });
  if (error || data?.error) throw new Error(data?.error || 'Owner service request failed. Check Edge Function deployment and secrets.');
  return data;
}
function renderUsers(users) {
  const target = document.querySelector('[data-user-results]'); target.replaceChildren();
  if (!users?.length) { target.append(node('p', 'No matching users.', 'muted')); return; }
  users.forEach(user => {
    const card = node('article', null, 'owner-user');
    const title = user.discord_global_name || user.discord_username || 'Discord account';
    card.append(node('h3', title));
    card.append(node('p', `Discord ID: ${user.discord_id || 'not linked'}`));
    card.append(node('p', `Account ID: ${user.user_id}`));
    card.append(node('p', `Current plan: ${user.subscription?.plan || 'Free'} · ${user.subscription?.status || 'active'}`));
    const actions = node('div', null, 'user-actions');
    const select = document.createElement('select'); select.setAttribute('aria-label', `Choose plan for ${title}`);
    plans.forEach(plan => { const option = node('option', plan); option.value = plan; option.selected = user.subscription?.plan === plan; select.append(option); });
    const update = node('button', 'Set plan');
    update.addEventListener('click', async () => { update.disabled = true; try { await adminAction('set_plan', { discord_id: user.discord_id, plan: select.value }); report(`Plan changed to ${select.value}.`, true); await searchUser(user.discord_id); } catch (error) { report(error.message); } finally { update.disabled = false; } });
    const remove = node('button', 'Remove plan', 'danger');
    remove.addEventListener('click', async () => { remove.disabled = true; try { await adminAction('remove_plan', { discord_id: user.discord_id }); report('Plan changed to Free.', true); await searchUser(user.discord_id); } catch (error) { report(error.message); } finally { remove.disabled = false; } });
    const key = node('button', 'Create license key');
    key.addEventListener('click', async () => { key.disabled = true; try { const result = await adminAction('create_key', { user_id: user.user_id }); report(`New key (shown once): ${result.key}`, true); await loadKeys(user.user_id); } catch (error) { report(error.message); } finally { key.disabled = false; } });
    actions.append(select, update, remove, key); card.append(actions); target.append(card);
    loadKeys(user.user_id);
  });
}
async function searchUser(discordId) {
  try { const result = await adminAction('search_discord', { discord_id: discordId }); renderUsers(result.user ? [result.user] : []); }
  catch (error) { report(error.message); }
}
async function loadKeys(userId) {
  const target = document.querySelector('[data-key-results]');
  try {
    const { data: keys, error } = await supabase.from('license_keys').select('id,key_prefix,key_suffix,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    target.replaceChildren();
    if (!keys?.length) { target.append(node('p', 'No license keys for this account.', 'muted')); return; }
    keys.forEach(key => {
      const row = node('div', null, 'owner-user');
      row.append(node('p', `${key.key_prefix}-••••-${key.key_suffix} · ${key.status}`));
      if (key.status === 'active') {
        const revoke = node('button', 'Revoke key', 'danger');
        revoke.addEventListener('click', async () => { revoke.disabled = true; try { await adminAction('revoke_key', { key_id: key.id }); report('License key revoked.', true); await loadKeys(userId); } catch (error) { report(error.message); revoke.disabled = false; } });
        row.append(revoke);
      }
      target.append(row);
    });
  } catch { target.replaceChildren(node('p', 'Could not load license keys. Check Supabase schema setup.', 'muted')); }
}
async function start() {
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) { status.textContent = 'Supabase configuration is missing.'; return; }
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: true, persistSession: true } });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) { location.replace(loginUrl); return; }
    const { data: isOwner, error: ownerError } = await supabase.rpc('is_spider_owner');
    if (ownerError || isOwner !== true) { location.replace(dashboardUrl); return; }
    status.hidden = true; panel.hidden = false;
    document.querySelector('[data-search-form]').addEventListener('submit', event => { event.preventDefault(); const id = new FormData(event.currentTarget).get('discord_id').toString().trim(); report('Searching…'); searchUser(id); });
    document.querySelector('[data-list-users]').addEventListener('click', async event => { event.currentTarget.disabled = true; report('Loading users…'); try { const result = await adminAction('list_users'); renderUsers(result.users); report(`${result.users.length} user(s) loaded.`, true); } catch (error) { report(error.message); } finally { event.currentTarget.disabled = false; } });
    document.querySelector('[data-owner-logout]').addEventListener('click', async () => { await supabase.auth.signOut(); location.replace(loginUrl); });
    supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') location.replace(loginUrl); });
  } catch (error) { status.textContent = 'Could not verify owner access. Check Supabase configuration.'; console.error(error); }
}
start();

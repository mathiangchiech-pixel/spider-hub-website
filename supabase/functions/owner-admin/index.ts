import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const corsHeaders = { 'Access-Control-Allow-Origin': appUrl || '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const plans = new Set(['Free', 'Basic', 'Premium', 'Pro', 'Enterprise']);
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
function makeLicense() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const value = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `SPIDER-${value.match(/.{1,6}/g)!.join('-')}`;
}
async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer || !supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Sign in required.' }, 401);
  const verifier = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await verifier.auth.getUser(bearer);
  if (authError || !user) return json({ error: 'Your session is invalid or expired.' }, 401);

  // Do not trust a role, user ID, or plan supplied by browser code.
  const { data: owner, error: ownerError } = await admin.from('owner_accounts').select('user_id').eq('user_id', user.id).maybeSingle();
  if (ownerError || !owner) return json({ error: 'Owner access required.' }, 403);

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const action = input.action;

  if (action === 'list_users') {
    const { data: profiles, error } = await admin.from('profiles').select('user_id,discord_id,discord_username,discord_global_name,discord_connected_at').order('created_at', { ascending: false }).limit(100);
    if (error) return json({ error: 'Unable to load users.' }, 500);
    const ids = (profiles || []).map(profile => profile.user_id);
    const { data: subscriptions } = ids.length ? await admin.from('user_subscriptions').select('user_id,plan,status,updated_at').in('user_id', ids) : { data: [] };
    const byId = new Map((subscriptions || []).map(item => [item.user_id, item]));
    return json({ users: (profiles || []).map(profile => ({ ...profile, subscription: byId.get(profile.user_id) || { plan: 'Free', status: 'active' } })) });
  }

  if (action === 'search_discord') {
    const discordId = typeof input.discord_id === 'string' ? input.discord_id.trim() : '';
    if (!/^\d{17,20}$/.test(discordId)) return json({ error: 'Enter a valid Discord user ID (17–20 digits).' }, 400);
    const { data: profile, error } = await admin.from('profiles').select('user_id,discord_id,discord_username,discord_global_name,discord_connected_at').eq('discord_id', discordId).maybeSingle();
    if (error) return json({ error: 'Unable to search users.' }, 500);
    if (!profile) return json({ user: null });
    const { data: subscription } = await admin.from('user_subscriptions').select('plan,status,updated_at').eq('user_id', profile.user_id).maybeSingle();
    return json({ user: { ...profile, subscription: subscription || { plan: 'Free', status: 'active' } } });
  }

  if (action === 'set_plan' || action === 'remove_plan') {
    const discordId = typeof input.discord_id === 'string' ? input.discord_id.trim() : '';
    const { data: profile, error: findError } = await admin.from('profiles').select('user_id').eq('discord_id', discordId).maybeSingle();
    if (findError) return json({ error: 'Unable to look up that account.' }, 500);
    if (!profile) return json({ error: 'No linked account found for that Discord ID.' }, 404);
    const plan = action === 'remove_plan' ? 'Free' : input.plan;
    if (typeof plan !== 'string' || !plans.has(plan)) return json({ error: 'Choose a supported plan.' }, 400);
    const { error } = await admin.from('user_subscriptions').upsert({ user_id: profile.user_id, plan, status: 'active', updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: 'user_id' });
    if (error) return json({ error: 'Unable to update the subscription.' }, 500);
    return json({ ok: true, discord_id: discordId, plan });
  }

  if (action === 'create_key') {
    const userId = typeof input.user_id === 'string' ? input.user_id : '';
    const { data: target, error: targetError } = await admin.from('profiles').select('user_id').eq('user_id', userId).maybeSingle();
    if (targetError || !target) return json({ error: 'Choose a valid Spider Websites user first.' }, 404);
    const rawKey = makeLicense();
    const { data: row, error } = await admin.from('license_keys').insert({ user_id: userId, key_hash: await hash(rawKey), key_prefix: 'SPIDER', key_suffix: rawKey.slice(-6), created_by: user.id }).select('id,key_prefix,key_suffix,status,created_at').single();
    if (error) return json({ error: 'Unable to create license key.' }, 500);
    return json({ key: rawKey, license: row }); // Raw secret is returned only once; database stores its hash.
  }

  if (action === 'revoke_key') {
    const keyId = typeof input.key_id === 'string' ? input.key_id : '';
    const { data, error } = await admin.from('license_keys').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', keyId).eq('status', 'active').select('id').maybeSingle();
    if (error) return json({ error: 'Unable to revoke this key.' }, 500);
    if (!data) return json({ error: 'Active license key not found.' }, 404);
    return json({ ok: true });
  }
  return json({ error: 'Unknown action.' }, 400);
});

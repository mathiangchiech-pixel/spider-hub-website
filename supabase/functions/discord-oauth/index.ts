import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const discordClientId = Deno.env.get('DISCORD_CLIENT_ID')!;
const discordClientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')!;
const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
const callbackUrl = `${supabaseUrl}/functions/v1/discord-oauth`;
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const corsHeaders = { 'Access-Control-Allow-Origin': appUrl || '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Vary': 'Origin' };

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function authenticatedUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  return error ? null : user;
}
function finishRedirect(result: string) {
  const target = new URL('/dashboard/', appUrl || 'https://localhost');
  target.searchParams.set('discord', result);
  return Response.redirect(target.toString(), 303);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!supabaseUrl || !anonKey || !serviceKey || !discordClientId || !discordClientSecret || !appUrl) return reply({ error: 'Discord OAuth is not configured on the server.' }, 500);

  const url = new URL(request.url);
  if (request.method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state || state.length > 200) return finishRedirect('failed');

    const stateHash = await sha256(state);
    const { data: userId, error: stateError } = await admin.rpc('consume_discord_oauth_state', { p_state_hash: stateHash });
    if (stateError || !userId) return finishRedirect('invalid-state');

    try {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: discordClientId, client_secret: discordClientSecret, grant_type: 'authorization_code', code, redirect_uri: callbackUrl })
      });
      if (!tokenResponse.ok) return finishRedirect('failed');
      const tokenData = await tokenResponse.json();
      if (typeof tokenData.access_token !== 'string') return finishRedirect('failed');

      const identityResponse = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      if (!identityResponse.ok) return finishRedirect('failed');
      const identity = await identityResponse.json();
      if (typeof identity.id !== 'string' || typeof identity.username !== 'string') return finishRedirect('failed');

      const { error: saveError } = await admin.from('profiles').upsert({
        user_id: userId,
        discord_id: identity.id,
        discord_username: identity.username,
        discord_global_name: typeof identity.global_name === 'string' ? identity.global_name : null,
        discord_avatar: typeof identity.avatar === 'string' ? identity.avatar : null,
        discord_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (saveError) return finishRedirect(saveError.code === '23505' ? 'already-linked' : 'failed');
      return finishRedirect('connected');
    } catch {
      return finishRedirect('failed');
    }
  }

  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  const user = await authenticatedUser(request);
  if (!user) return reply({ error: 'Sign in to your Spider Websites account first.' }, 401);
  let body: { action?: string };
  try { body = await request.json(); } catch { return reply({ error: 'Invalid request.' }, 400); }

  if (body.action === 'start') {
    const state = randomState();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await admin.from('discord_oauth_states').insert({ state_hash: await sha256(state), user_id: user.id, expires_at: expiresAt });
    if (error) return reply({ error: 'Unable to start Discord authorization.' }, 500);
    const authorize = new URL('https://discord.com/oauth2/authorize');
    authorize.search = new URLSearchParams({ client_id: discordClientId, response_type: 'code', redirect_uri: callbackUrl, scope: 'identify', state }).toString();
    return reply({ url: authorize.toString() });
  }

  if (body.action === 'disconnect') {
    const { error } = await admin.from('profiles').upsert({ user_id: user.id, discord_id: null, discord_username: null, discord_global_name: null, discord_avatar: null, discord_connected_at: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return reply({ error: 'Unable to disconnect Discord. Please try again.' }, 500);
    return reply({ connected: false });
  }
  return reply({ error: 'Unknown action.' }, 400);
});

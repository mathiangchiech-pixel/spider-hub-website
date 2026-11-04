-- Spider Websites account, Discord-link, plan, script and license-key schema.
-- Run in the Supabase SQL editor. Add owner UUID(s) to owner_accounts only after signup.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique,
  discord_username text,
  discord_global_name text,
  discord_avatar text,
  discord_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'Free' check (plan in ('Free', 'Basic', 'Premium', 'Pro', 'Enterprise')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'inactive')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.user_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  key_suffix text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.discord_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.profiles enable row level security;
alter table public.owner_accounts enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.user_scripts enable row level security;
alter table public.license_keys enable row level security;
alter table public.discord_oauth_states enable row level security;

revoke all on public.profiles, public.owner_accounts, public.user_subscriptions,
  public.user_scripts, public.license_keys, public.discord_oauth_states from anon, authenticated;
grant select on public.profiles, public.user_subscriptions, public.user_scripts to authenticated;
grant select (id, key_prefix, key_suffix, status, created_at, revoked_at)
  on public.license_keys to authenticated;

create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy "Users read own subscription" on public.user_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "Users read own scripts" on public.user_scripts for select to authenticated using (auth.uid() = user_id);
create policy "Users read own license key metadata" on public.license_keys for select to authenticated using (auth.uid() = user_id);

create or replace function public.is_spider_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.owner_accounts where user_id = (select auth.uid()));
$$;
revoke all on function public.is_spider_owner() from public, anon;
grant execute on function public.is_spider_owner() to authenticated;

-- Atomically consume each short-lived OAuth state once. Edge Functions call this
-- with the service-role client; browsers are never granted access to this table.
create or replace function public.consume_discord_oauth_state(p_state_hash text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare linked_user uuid;
begin
  delete from public.discord_oauth_states
  where state_hash = p_state_hash and expires_at > now()
  returning user_id into linked_user;
  return linked_user;
end;
$$;
revoke all on function public.consume_discord_oauth_state(text) from public, anon, authenticated;
grant execute on function public.consume_discord_oauth_state(text) to service_role;

-- Owner authorization is enforced again inside each owner Edge Function. RLS
-- gives normal users no insert/update/delete permissions for plans or keys.

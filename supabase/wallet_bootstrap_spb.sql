-- Direct wallet bootstrap for Enter-managed project spb-t4n3j6fi3bx1eua7
-- Run this once in the SQL editor for the active production database.

create extension if not exists pgcrypto;

create table if not exists public.user_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cash_balance numeric(14,2) not null default 0,
  cruise_coin_balance numeric(14,2) not null default 0,
  pending_balance numeric(14,2) not null default 0,
  total_earnings numeric(14,2) not null default 0,
  total_withdrawals numeric(14,2) not null default 0,
  is_frozen boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_exchange_settings (
  id boolean primary key default true,
  coin_to_naira_rate numeric(12,4) not null default 1.0000,
  min_withdrawal_amount numeric(14,2) not null default 1000,
  min_coin_conversion numeric(14,2) not null default 1,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (id)
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_type text not null check (transaction_type in (
    'reward',
    'referral',
    'advertisement',
    'coin_conversion',
    'withdrawal',
    'deposit',
    'bonus',
    'manual_admin_credit',
    'manual_admin_debit'
  )),
  asset_type text not null check (asset_type in ('cash', 'coin')),
  amount numeric(14,2) not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'reversed')),
  description text,
  reference_number text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  payment_method text,
  account_details jsonb not null default '{}'::jsonb,
  reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wallet_transactions_user_created on public.wallet_transactions(user_id, created_at desc);
create index if not exists idx_withdrawal_requests_status_created on public.withdrawal_requests(status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_mutation_on_immutable_tables()
returns trigger
language plpgsql
as $$
begin
  raise exception 'This table is immutable. Create reversal entries instead.';
end;
$$;

create or replace function public.ensure_wallet_for_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_wallets (user_id, cruise_coin_balance)
  values (new.id, coalesce(new.coins, 0)::numeric)
  on conflict (user_id) do update
    set cruise_coin_balance = excluded.cruise_coin_balance,
        updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_wallet_coin_balance_from_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_wallets (user_id, cruise_coin_balance)
  values (new.id, coalesce(new.coins, 0)::numeric)
  on conflict (user_id) do update
    set cruise_coin_balance = coalesce(new.coins, 0)::numeric,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_withdrawal_requests_updated_at on public.withdrawal_requests;
create trigger trg_withdrawal_requests_updated_at
before update on public.withdrawal_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_wallet_tx_no_update on public.wallet_transactions;
create trigger trg_wallet_tx_no_update
before update or delete on public.wallet_transactions
for each row execute function public.prevent_mutation_on_immutable_tables();

drop trigger if exists trg_profiles_wallet_bootstrap on public.profiles;
create trigger trg_profiles_wallet_bootstrap
after insert on public.profiles
for each row execute function public.ensure_wallet_for_profile();

drop trigger if exists trg_profiles_wallet_coin_sync on public.profiles;
create trigger trg_profiles_wallet_coin_sync
after update of coins on public.profiles
for each row execute function public.sync_wallet_coin_balance_from_profile();

insert into public.user_wallets (user_id, cruise_coin_balance)
select p.id, coalesce(p.coins, 0)::numeric
from public.profiles p
on conflict (user_id) do update
  set cruise_coin_balance = excluded.cruise_coin_balance,
      updated_at = now();

insert into public.coin_exchange_settings (id, coin_to_naira_rate, min_withdrawal_amount, min_coin_conversion)
values (true, 1.0000, 1000, 1)
on conflict (id) do update
  set coin_to_naira_rate = coalesce(public.coin_exchange_settings.coin_to_naira_rate, excluded.coin_to_naira_rate),
      min_withdrawal_amount = coalesce(public.coin_exchange_settings.min_withdrawal_amount, excluded.min_withdrawal_amount),
      min_coin_conversion = coalesce(public.coin_exchange_settings.min_coin_conversion, excluded.min_coin_conversion),
      updated_at = now();

alter table public.user_wallets enable row level security;
alter table public.coin_exchange_settings enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.withdrawal_requests enable row level security;

drop policy if exists "Users own wallet read" on public.user_wallets;
create policy "Users own wallet read" on public.user_wallets
  for select using (auth.uid() = user_id);

drop policy if exists "Public read exchange settings" on public.coin_exchange_settings;
create policy "Public read exchange settings" on public.coin_exchange_settings
  for select using (true);

drop policy if exists "Users own wallet tx read" on public.wallet_transactions;
create policy "Users own wallet tx read" on public.wallet_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Users own withdrawals read" on public.withdrawal_requests;
create policy "Users own withdrawals read" on public.withdrawal_requests
  for select using (auth.uid() = user_id);

drop policy if exists "Users create withdrawals" on public.withdrawal_requests;
create policy "Users create withdrawals" on public.withdrawal_requests
  for insert with check (auth.uid() = user_id);

create or replace function public.fund_wallet(
  p_amount numeric,
  p_payment_method text default 'manual',
  p_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ref text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Funding amount must be greater than zero';
  end if;

  insert into public.user_wallets(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.user_wallets
  set cash_balance = cash_balance + p_amount,
      total_earnings = total_earnings + p_amount,
      updated_at = now()
  where user_id = auth.uid()
    and is_frozen = false;

  if not found then
    raise exception 'Wallet is frozen';
  end if;

  v_ref := coalesce(
    nullif(trim(p_reference), ''),
    'FND-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  );

  insert into public.wallet_transactions(
    user_id,
    transaction_type,
    asset_type,
    amount,
    status,
    description,
    reference_number,
    created_by,
    metadata
  ) values (
    auth.uid(),
    'deposit',
    'cash',
    p_amount,
    'completed',
    'Wallet funded',
    v_ref,
    auth.uid(),
    jsonb_build_object('source', 'fund_wallet', 'payment_method', coalesce(p_payment_method, 'manual'), 'notes', p_notes)
  );

  return jsonb_build_object('ok', true, 'reference_number', v_ref, 'amount', p_amount);
end;
$$;

create or replace function public.convert_cruise_coins_to_cash(
  p_coin_amount numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_rate numeric := 1;
  v_min_coin_conversion numeric := 1;
  v_cash_amount numeric := 0;
  v_ref text;
  v_current_coins numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_coin_amount is null or p_coin_amount <= 0 then
    raise exception 'Coin amount must be greater than zero';
  end if;

  select coin_to_naira_rate, min_coin_conversion
  into v_rate, v_min_coin_conversion
  from public.coin_exchange_settings
  where id = true;

  v_rate := coalesce(v_rate, 1);
  v_min_coin_conversion := coalesce(v_min_coin_conversion, 1);

  if p_coin_amount < v_min_coin_conversion then
    raise exception 'Minimum coin conversion is %', v_min_coin_conversion;
  end if;

  select coalesce(coins, 0)
  into v_current_coins
  from public.profiles
  where id = auth.uid();

  if v_current_coins < p_coin_amount then
    raise exception 'Insufficient Cruise Coin balance';
  end if;

  v_cash_amount := round((p_coin_amount * v_rate)::numeric, 2);

  insert into public.user_wallets(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.profiles
  set coins = coins - p_coin_amount
  where id = auth.uid();

  update public.user_wallets
  set cash_balance = cash_balance + v_cash_amount,
      total_earnings = total_earnings + v_cash_amount,
      cruise_coin_balance = greatest(coalesce(cruise_coin_balance, 0) - p_coin_amount, 0),
      updated_at = now()
  where user_id = auth.uid()
    and is_frozen = false;

  if not found then
    raise exception 'Wallet is frozen';
  end if;

  v_ref := 'CNV-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.wallet_transactions(
    user_id,
    transaction_type,
    asset_type,
    amount,
    status,
    description,
    reference_number,
    created_by,
    metadata
  ) values (
    auth.uid(),
    'coin_conversion',
    'cash',
    v_cash_amount,
    'completed',
    'Cruise Coin converted to wallet balance',
    v_ref,
    auth.uid(),
    jsonb_build_object('source', 'convert_cruise_coins_to_cash', 'coin_amount', p_coin_amount, 'rate', v_rate)
  );

  return jsonb_build_object(
    'ok', true,
    'reference_number', v_ref,
    'coin_amount', p_coin_amount,
    'cash_amount', v_cash_amount,
    'rate', v_rate
  );
end;
$$;

create or replace function public.convert_coins_to_cash(
  p_coin_amount numeric
)
returns jsonb
language plpgsql
security definer
as $$
begin
  return public.convert_cruise_coins_to_cash(p_coin_amount);
end;
$$;

create or replace function public.request_withdrawal(
  p_amount numeric,
  p_payment_method text,
  p_account_details jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_min_withdrawal numeric := 1000;
  v_ref text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select min_withdrawal_amount
  into v_min_withdrawal
  from public.coin_exchange_settings
  where id = true;

  v_min_withdrawal := coalesce(v_min_withdrawal, 1000);

  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  if p_amount < v_min_withdrawal then
    raise exception 'Minimum withdrawal is %', v_min_withdrawal;
  end if;

  insert into public.user_wallets(user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.user_wallets
  set cash_balance = cash_balance - p_amount,
      pending_balance = pending_balance + p_amount,
      updated_at = now()
  where user_id = auth.uid()
    and is_frozen = false
    and cash_balance >= p_amount;

  if not found then
    raise exception 'Insufficient balance or wallet frozen';
  end if;

  insert into public.withdrawal_requests(
    user_id,
    amount,
    status,
    payment_method,
    account_details,
    reason
  ) values (
    auth.uid(),
    p_amount,
    'pending',
    p_payment_method,
    coalesce(p_account_details, '{}'::jsonb),
    p_reason
  );

  v_ref := 'WTH-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.wallet_transactions(
    user_id,
    transaction_type,
    asset_type,
    amount,
    status,
    description,
    reference_number,
    created_by,
    metadata
  ) values (
    auth.uid(),
    'withdrawal',
    'cash',
    p_amount,
    'pending',
    'Withdrawal request submitted',
    v_ref,
    auth.uid(),
    jsonb_build_object('source', 'request_withdrawal')
  );

  return jsonb_build_object('ok', true, 'reference_number', v_ref);
end;
$$;

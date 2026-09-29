-- Stripe-specific site binding layered on top of the provider-neutral billing engine.
alter table public.site_subscriptions
  add column if not exists provider_price_id text;

create index if not exists site_subscriptions_provider_customer_idx
  on public.site_subscriptions(provider_customer_id)
  where provider_customer_id is not null;

create index if not exists site_subscriptions_provider_price_idx
  on public.site_subscriptions(provider_price_id)
  where provider_price_id is not null;

create or replace function private.bind_builder_site_subscription_provider(
  p_site_id uuid,
  p_owner_id uuid,
  p_plan_key text,
  p_provider text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_price_id text,
  p_provider_status text,
  p_current_period_end timestamptz default null
)
returns text
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_site_id is null or p_owner_id is null then
    raise exception 'site_and_owner_required';
  end if;

  if not exists(
    select 1
    from public.sites
    where id=p_site_id and owner_id=p_owner_id
  ) then
    raise exception 'site_owner_mismatch';
  end if;

  if not exists(
    select 1
    from public.subscription_plans
    where key=p_plan_key and active=true
  ) then
    raise exception 'invalid_plan';
  end if;

  if nullif(trim(p_provider),'') is null
     or nullif(trim(p_provider_customer_id),'') is null
     or nullif(trim(p_provider_subscription_id),'') is null then
    raise exception 'provider_binding_required';
  end if;

  insert into public.site_subscriptions(
    site_id,
    owner_id,
    plan_key,
    status,
    provider,
    provider_customer_id,
    provider_subscription_id,
    provider_price_id,
    current_period_end
  )
  values(
    p_site_id,
    p_owner_id,
    p_plan_key,
    p_provider_status,
    p_provider,
    p_provider_customer_id,
    p_provider_subscription_id,
    p_provider_price_id,
    p_current_period_end
  )
  on conflict(site_id) do update
  set owner_id=excluded.owner_id,
      plan_key=excluded.plan_key,
      status=excluded.status,
      provider=excluded.provider,
      provider_customer_id=excluded.provider_customer_id,
      provider_subscription_id=excluded.provider_subscription_id,
      provider_price_id=excluded.provider_price_id,
      current_period_end=coalesce(excluded.current_period_end,public.site_subscriptions.current_period_end),
      updated_at=now();

  return 'bound';
end
$$;

revoke all on function private.bind_builder_site_subscription_provider(
  uuid,uuid,text,text,text,text,text,text,timestamptz
) from public,anon,authenticated;
grant execute on function private.bind_builder_site_subscription_provider(
  uuid,uuid,text,text,text,text,text,text,timestamptz
) to service_role;

create or replace function public.bind_builder_site_subscription_provider(
  p_site_id uuid,
  p_owner_id uuid,
  p_plan_key text,
  p_provider text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_price_id text,
  p_provider_status text,
  p_current_period_end timestamptz default null
)
returns text
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.bind_builder_site_subscription_provider(
    p_site_id,
    p_owner_id,
    p_plan_key,
    p_provider,
    p_provider_customer_id,
    p_provider_subscription_id,
    p_provider_price_id,
    p_provider_status,
    p_current_period_end
  )
$$;

revoke all on function public.bind_builder_site_subscription_provider(
  uuid,uuid,text,text,text,text,text,text,timestamptz
) from public,anon,authenticated;
grant execute on function public.bind_builder_site_subscription_provider(
  uuid,uuid,text,text,text,text,text,text,timestamptz
) to service_role;

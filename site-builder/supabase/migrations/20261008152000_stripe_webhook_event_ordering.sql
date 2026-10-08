-- Prevent delayed Stripe webhooks from overwriting a newer subscription projection.
-- The Stripe event creation time is authoritative for ordering; delivery time is not.

alter table public.site_subscriptions
  add column if not exists provider_event_created_at timestamptz;

alter table public.billing_provider_events
  add column if not exists provider_created_at timestamptz;

create index if not exists site_subscriptions_provider_event_created_idx
  on public.site_subscriptions(provider_event_created_at)
  where provider_event_created_at is not null;

create or replace function private.apply_builder_site_billing_provider_event_v2(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_site_id uuid,
  p_owner_id uuid,
  p_plan_key text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_price_id text,
  p_provider_status text,
  p_paid_through timestamptz,
  p_failed_at timestamptz,
  p_provider_created_at timestamptz
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_current public.site_subscriptions%rowtype;
  v_has_current boolean := false;
  v_result text := 'projection_updated';
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
     or nullif(trim(p_event_id),'') is null
     or nullif(trim(p_event_type),'') is null
     or nullif(trim(p_provider_customer_id),'') is null
     or nullif(trim(p_provider_subscription_id),'') is null
     or nullif(trim(p_provider_status),'') is null
     or p_provider_created_at is null then
    raise exception 'provider_event_required';
  end if;

  insert into public.billing_provider_events(
    provider,event_id,event_type,provider_created_at
  )
  values(
    p_provider,p_event_id,p_event_type,p_provider_created_at
  )
  on conflict(provider,event_id) do nothing;

  if not found then return 'duplicate'; end if;

  select *
  into v_current
  from public.site_subscriptions
  where site_id=p_site_id
  for update;
  v_has_current := found;

  -- Stripe can retry an older event after a newer event was already delivered.
  -- Preserve a first-payment proof from an old invoice.paid, but never let it
  -- move the current subscription state backwards.
  if v_has_current
     and v_current.provider_subscription_id=p_provider_subscription_id
     and v_current.provider_event_created_at is not null
     and p_provider_created_at < v_current.provider_event_created_at then

    if p_event_type='payment_succeeded'
       and v_current.first_payment_confirmed_at is null then
      update public.site_subscriptions
      set first_payment_confirmed_at=p_provider_created_at,
          updated_at=now()
      where site_id=p_site_id and owner_id=p_owner_id;
    end if;

    update public.billing_provider_events
    set processed_at=now(),processing_status='ignored'
    where provider=p_provider and event_id=p_event_id;

    return 'stale_ignored';
  end if;

  -- A Stripe subscription id is terminal once canceled. A later retry for an
  -- older invoice must not resurrect the same canceled subscription.
  if v_has_current
     and v_current.provider_subscription_id=p_provider_subscription_id
     and v_current.status='canceled'
     and p_provider_status<>'canceled' then

    if p_event_type='payment_succeeded'
       and v_current.first_payment_confirmed_at is null then
      update public.site_subscriptions
      set first_payment_confirmed_at=p_provider_created_at,
          updated_at=now()
      where site_id=p_site_id and owner_id=p_owner_id;
    end if;

    update public.billing_provider_events
    set processed_at=now(),processing_status='ignored'
    where provider=p_provider and event_id=p_event_id;

    return 'terminal_ignored';
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
    current_period_end,
    provider_event_created_at
  )
  values(
    p_site_id,
    p_owner_id,
    p_plan_key,
    p_provider_status,
    p_provider,
    p_provider_customer_id,
    p_provider_subscription_id,
    nullif(trim(p_provider_price_id),''),
    p_paid_through,
    p_provider_created_at
  )
  on conflict(site_id) do update
  set owner_id=excluded.owner_id,
      plan_key=excluded.plan_key,
      status=excluded.status,
      provider=excluded.provider,
      provider_customer_id=excluded.provider_customer_id,
      provider_subscription_id=excluded.provider_subscription_id,
      provider_price_id=coalesce(excluded.provider_price_id,public.site_subscriptions.provider_price_id),
      current_period_end=coalesce(excluded.current_period_end,public.site_subscriptions.current_period_end),
      provider_event_created_at=excluded.provider_event_created_at,
      updated_at=now();

  if p_event_type in ('payment_failed','subscription_past_due') then
    perform private.start_builder_payment_grace(
      p_site_id,
      p_owner_id,
      coalesce(p_failed_at,p_provider_created_at),
      p_provider_status,
      p_provider||':'||p_event_id
    );
    v_result := 'grace_started';
  elsif p_event_type='payment_succeeded' then
    update public.site_subscriptions
    set first_payment_confirmed_at=coalesce(first_payment_confirmed_at,p_provider_created_at),
        updated_at=now()
    where site_id=p_site_id and owner_id=p_owner_id;

    perform private.reactivate_builder_site(
      p_site_id,
      p_owner_id,
      p_paid_through,
      p_provider_status,
      p_provider||':'||p_event_id
    );
    v_result := 'reactivated';
  elsif p_event_type='subscription_active' then
    v_result := 'projection_updated';
  elsif p_event_type='subscription_canceled' then
    v_result := 'canceled';
  end if;

  update public.billing_provider_events
  set processed_at=now(),processing_status='processed'
  where provider=p_provider and event_id=p_event_id;

  return v_result;
exception
  when others then
    update public.billing_provider_events
    set processed_at=now(),
        processing_status='failed',
        last_error=left(sqlerrm,500)
    where provider=p_provider and event_id=p_event_id;
    raise;
end
$$;

revoke all on function private.apply_builder_site_billing_provider_event_v2(
  text,text,text,uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz
) from public,anon,authenticated;
grant execute on function private.apply_builder_site_billing_provider_event_v2(
  text,text,text,uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz
) to service_role;

create or replace function public.apply_builder_site_billing_provider_event_v2(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_site_id uuid,
  p_owner_id uuid,
  p_plan_key text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_price_id text,
  p_provider_status text,
  p_paid_through timestamptz,
  p_failed_at timestamptz,
  p_provider_created_at timestamptz
)
returns text
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.apply_builder_site_billing_provider_event_v2(
    p_provider,
    p_event_id,
    p_event_type,
    p_site_id,
    p_owner_id,
    p_plan_key,
    p_provider_customer_id,
    p_provider_subscription_id,
    p_provider_price_id,
    p_provider_status,
    p_paid_through,
    p_failed_at,
    p_provider_created_at
  )
$$;

revoke all on function public.apply_builder_site_billing_provider_event_v2(
  text,text,text,uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz
) from public,anon,authenticated;
grant execute on function public.apply_builder_site_billing_provider_event_v2(
  text,text,text,uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,timestamptz
) to service_role;

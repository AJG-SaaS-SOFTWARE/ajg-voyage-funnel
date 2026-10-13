import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("detached purchased BUILD enables bounded AI without RUN or ordinary free AI", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-0000-0000-000000000001";
  const site = "00000000-0000-0000-0000-000000000002";
  const req = "00000000-0000-0000-0000-000000000003";
  const otherSite = "00000000-0000-0000-0000-000000000004";
  try {
    await db.exec(`
      create schema auth; create schema private;
      create role anon; create role authenticated; create role service_role;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function public.has_active_beta_access() returns boolean language sql stable as $$select false$$;
      create function public.get_my_site_entitlements(uuid) returns table(plan_key text, subscription_status text, ai_minute_limit int, ai_daily_limit int, ai_monthly_limit int)
        language sql stable as $$select coalesce(nullif(current_setting('test.plan',true),''),'free'), 'active',0,0,0$$;
      create table public.sites(id uuid primary key,owner_id uuid,privacy_state text);
      create table public.site_subscriptions(site_id uuid,owner_id uuid,first_payment_confirmed_at timestamptz);
      create table public.site_billing_states(site_id uuid,state text);
      create table public.site_ai_launch_entitlements(site_id uuid,owner_id uuid,source text,status text,operations_total int,operations_used int,expires_at timestamptz);
      create table public.ai_usage_events(user_id uuid,site_id uuid,request_id uuid unique,created_at timestamptz);
      insert into public.sites values ('${site}','${owner}','active'),('${otherSite}','${owner}','active');
      select set_config('test.uid','${owner}',false);
    `);
    for (const file of ["20261012_detached_ai_launch_build_only.sql", "20261012_detached_build_quota_admission.sql"]) {
      await db.exec(fs.readFileSync(new URL(`../docs/migrations/${file}`,import.meta.url),"utf8"));
    }
    const capabilities = async (id=site) => (await db.query("select * from public.get_my_site_capabilities($1)",[id])).rows[0];
    const reserve = async (id,target=site) => (await db.query("select private.reserve_my_site_ai_generation_internal($1,$2) as result",[target,id])).rows[0].result;
    assert.equal((await capabilities()).can_generate_ai,false);
    assert.equal(await reserve(req),"unavailable");
    await db.exec(`insert into public.site_ai_launch_entitlements values ('${site}','${owner}','admin_grant','active',1,0,null)`);
    assert.equal((await capabilities()).can_generate_ai,false);
    await db.exec("update public.site_ai_launch_entitlements set source='stripe_purchase'");
    let flags=await capabilities();
    assert.equal(flags.can_generate_ai,true);
    for (const key of ["can_publish","public_site_available","can_import","can_export","can_collect_leads"]) assert.equal(flags[key],false,key);
    assert.equal(flags.can_edit,true);
    assert.equal(await reserve(req),"ok");
    assert.equal(await reserve(req),"ok");
    assert.equal((await db.query("select count(*)::int as n from public.ai_usage_events")).rows[0].n,1);
    assert.equal(await reserve(req,otherSite),"unavailable");
    assert.equal(await reserve("00000000-0000-0000-0000-000000000005"),"minute_limit");
    await db.exec("update public.site_ai_launch_entitlements set expires_at=now()-interval '1 minute'");
    assert.equal((await capabilities()).can_generate_ai,false);
    await db.exec("update public.site_ai_launch_entitlements set expires_at=null, operations_used=1");
    assert.equal((await capabilities()).can_generate_ai,false);
    await db.exec("update public.site_ai_launch_entitlements set operations_used=0; update public.sites set privacy_state='deletion_pending'");
    assert.equal((await capabilities()).can_generate_ai,false);
    await db.exec("update public.sites set privacy_state='active'; select set_config('test.uid','00000000-0000-0000-0000-000000000099',false)");
    assert.equal(await capabilities(),undefined);
    assert.equal(await reserve(req),"unavailable");
    await db.exec(`select set_config('test.uid','${owner}',false); select set_config('test.plan','essential',false);
      insert into public.site_subscriptions values ('${site}','${owner}',now());`);
    flags=await capabilities();
    assert.equal(flags.can_publish,true);
    assert.equal(flags.public_site_available,true);
  } finally { await db.close(); }
});

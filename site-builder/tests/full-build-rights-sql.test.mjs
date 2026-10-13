import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("Growth full redesign consumes BUILD atomically and cannot bypass ownership or credit", async () => {
  const db = new PGlite();
  const user = "00000000-0000-0000-0000-000000000001";
  const site = "00000000-0000-0000-0000-000000000002";
  const otherSite = "00000000-0000-0000-0000-000000000003";
  const entitlement = "00000000-0000-0000-0000-000000000004";
  const request = "00000000-0000-0000-0000-000000000005";
  try {
    await db.exec(`
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function public.has_active_beta_access() returns boolean language sql stable as $$select coalesce(current_setting('test.beta',true),'false')='true'$$;
      create function public.get_my_site_entitlements(uuid) returns table(plan_key text,subscription_status text)
        language sql stable as $$select 'growth'::text,'active'::text$$;
      create table public.sites(id uuid primary key,owner_id uuid);
      create table public.site_ai_launch_entitlements(
        id uuid primary key,site_id uuid,owner_id uuid,status text,operations_total int,operations_used int,
        expires_at timestamptz,granted_at timestamptz default now(),updated_at timestamptz default now()
      );
      create table public.site_ai_launch_operations(
        request_id uuid primary key,entitlement_id uuid,site_id uuid,owner_id uuid,operation text,status text,updated_at timestamptz
      );
      insert into public.sites values ('${site}','${user}'),('${otherSite}','00000000-0000-0000-0000-000000000099');
      select set_config('test.uid','${user}',false);
    `);
    await db.exec(fs.readFileSync(new URL("../supabase/migrations/20261013184716_align_full_build_offer_rights.sql",import.meta.url),"utf8"));
    const reserve = async (id, target = site) => (await db.query(
      "select private.reserve_my_site_launch_operation_internal($1,$2,'site_revision') as result",[target,id])).rows[0].result;
    const access = async () => (await db.query("select * from public.get_my_site_ai_access($1)",[site])).rows[0];
    assert.equal((await access()).can_revise_site,false);
    assert.equal(await reserve(request),"launch_required");
    assert.equal(await reserve(request,otherSite),"unauthorized");
    await db.exec(`insert into public.site_ai_launch_entitlements values ('${entitlement}','${site}','${user}','active',1,0,null,now(),now())`);
    assert.equal((await access()).can_revise_site,true);
    assert.equal(await reserve(request),"ok");
    assert.equal(await reserve(request),"ok");
    const ownedAlternative = "00000000-0000-0000-0000-000000000008";
    await db.exec(`insert into public.sites values ('${ownedAlternative}','${user}')`);
    assert.equal(await reserve(request,ownedAlternative),"request_conflict");
    assert.equal((await db.query("select private.reserve_my_site_launch_operation_internal($1,$2,'site_create') as result",[site,request])).rows[0].result,"request_conflict");
    assert.equal((await db.query("select operations_used from public.site_ai_launch_entitlements")).rows[0].operations_used,1);
    assert.equal((await access()).can_revise_site,false);
    assert.equal(await reserve("00000000-0000-0000-0000-000000000006"),"launch_required");
    await db.exec("select set_config('test.beta','true',false)");
    assert.equal(await reserve("00000000-0000-0000-0000-000000000007"),"unmetered_beta");
  } finally { await db.close(); }
});

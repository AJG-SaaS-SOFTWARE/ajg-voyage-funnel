import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = fs.readFileSync(new URL("../supabase/migrations/20261017213752_resolve_verified_primary_support_repair.sql", import.meta.url), "utf8");
const owner = "11111111-1111-4111-9111-111111111111";
const site = "22222222-2222-4222-9222-222222222222";
const ticket = "33333333-3333-4333-9333-333333333333";
const repair = "44444444-4444-4444-9444-444444444444";
const before = "2026-10-19T10:00:00Z";
const diagnosis = { checks: ["backend", "public_render", "domain"].map(key => ({ key, status: "healthy" })) };

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.sites(id uuid primary key, owner_id uuid, slug text, status text, privacy_state text, public_access_state text);
    create table public.domains(site_id uuid, kind text, hostname text, verification_status text, is_primary boolean);
    create table public.support_tickets(id uuid primary key, user_id uuid, site_id uuid, updated_at timestamptz,
      category text, status text, diagnosis jsonb, client_action text, resolution_code text, resolved_at timestamptz);
    create table public.support_remediation_runs(id uuid primary key, ticket_id uuid, user_id uuid, site_id uuid,
      action text, status text, result_code text, created_at timestamptz, trigger_source text);
    create table public.support_ticket_events(id bigint generated always as identity, ticket_id uuid, actor_type text, event_type text, metadata jsonb);
  `);
  await db.exec(migration);
  await db.query("insert into public.sites values ($1,$2,'fixture','published','active','live')", [site, owner]);
  await db.query("insert into public.domains values ($1,'managed_subdomain','fixture.example.test','verified',true)", [site]);
  await db.query("insert into public.support_tickets(id,user_id,site_id,updated_at,category,status,diagnosis) values($1,$2,$3,$4,'domain','diagnosed',$5)",
    [ticket, owner, site, before, { checks: [{ key: "domain", status: "incident" }] }]);
  await db.query("insert into public.support_remediation_runs values($1,null,$2,$3,'managed_domain_repair','succeeded','managed_domain_primary_repaired','2026-10-19T10:05:00Z','system')", [repair, owner, site]);
  return db;
}
async function resolve(db, expected = before, user = owner) {
  const { rows } = await db.query("select public.resolve_verified_primary_support_repair($1,$2,$3,$4,$5,'example.test') as result",
    [ticket, user, site, expected, diagnosis]);
  return rows[0].result;
}

test("executed SQL requires the system repair audit to be linked to the exact ticket and commits only once", async () => {
  const db = await setup();
  try {
    assert.equal(await resolve(db), null, "the old unlinked scheduled audit cannot authorize resolution");
    await db.query("update public.support_remediation_runs set ticket_id=$1 where id=$2", [ticket, repair]);
    const result = await resolve(db);
    assert.equal(result.ticketId, ticket); assert.equal(result.repairRunId, repair); assert.equal(result.status, "resolved");
    const { rows } = await db.query("select t.status,t.resolution_code,e.actor_type,e.metadata from public.support_tickets t join public.support_ticket_events e on e.ticket_id=t.id where t.id=$1", [ticket]);
    assert.equal(rows.length, 1); assert.equal(rows[0].status, "resolved");
    assert.equal(rows[0].actor_type, "system"); assert.equal(rows[0].metadata.repair_run_id, repair);
    assert.equal(await resolve(db), null, "stale replay cannot append a second resolution");
    assert.equal((await db.query("select count(*)::int as n from public.support_ticket_events")).rows[0].n, 1);
  } finally { await db.close(); }
});

test("executed SQL rejects changed ticket versions, foreign owners and a custom-domain race without resolution writes", async () => {
  const db = await setup();
  try {
    await db.query("update public.support_remediation_runs set ticket_id=$1 where id=$2", [ticket, repair]);
    assert.equal(await resolve(db, "2026-10-19T09:59:00Z"), null);
    assert.equal(await resolve(db, before, "55555555-5555-4555-9555-555555555555"), null);
    await db.query("insert into public.domains values($1,'custom_domain','customer.example.test','verified',false)", [site]);
    assert.equal(await resolve(db), null);
    assert.equal((await db.query("select status from public.support_tickets where id=$1", [ticket])).rows[0].status, "diagnosed");
    assert.equal((await db.query("select count(*)::int as n from public.support_ticket_events")).rows[0].n, 0);
  } finally { await db.close(); }
});

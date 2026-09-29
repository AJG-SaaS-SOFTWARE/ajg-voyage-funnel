import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../docs/migrations/20260929_add_privacy_erasure_requests.sql", import.meta.url),
  "utf8"
);
const route = fs.readFileSync(
  new URL("../app/api/privacy/erasure/request/route.ts", import.meta.url),
  "utf8"
);
const page = fs.readFileSync(
  new URL("../app/data/page.tsx", import.meta.url),
  "utf8"
);

test("privacy erasure state is independent from billing and blocks mutations", () => {
  assert.ok(migration.includes("privacy_state text not null default 'active'"));
  assert.ok(migration.includes("privacy_state='erasure_requested'"));
  assert.ok(migration.includes("public_access_state='suspended'"));
  assert.ok(migration.includes("privacy_state='active' and state in ('free','trial','active','grace')"));
  assert.ok(migration.includes("s.privacy_state='active'"));
});

test("erasure request RPCs are intended for service-role execution only", () => {
  assert.ok(
    migration.includes(
      "revoke all on function public.request_builder_site_erasure(uuid,uuid)"
    )
  );
  assert.ok(
    migration.includes(
      "grant execute on function public.request_builder_site_erasure(uuid,uuid)\nto service_role"
    )
  );
  assert.ok(
    migration.includes(
      "grant execute on function public.request_builder_account_erasure(uuid)\nto service_role"
    )
  );
});

test("site erasure requires exact slug confirmation and account erasure requires email", () => {
  assert.ok(route.includes("confirmation !== site.slug"));
  assert.ok(route.includes("confirmation.toLowerCase() !== email"));
  assert.ok(route.includes("request_builder_site_erasure"));
  assert.ok(route.includes("request_builder_account_erasure"));
});

test("data-rights UI offers export before erasure and strong confirmations", () => {
  assert.ok(page.includes("Télécharger mon archive"));
  assert.ok(page.includes("Demander l’effacement"));
  assert.ok(page.includes("Recopiez votre adresse e-mail pour confirmer"));
  assert.ok(page.includes("window.confirm"));
  assert.ok(page.includes("un impayé, une carte expirée ou un"));
});

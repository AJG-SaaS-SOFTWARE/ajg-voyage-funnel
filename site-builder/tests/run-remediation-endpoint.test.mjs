import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("internal autonomous run endpoint", () => {
  const source = readFileSync(
    new URL("../app/api/run/remediate/route.ts", import.meta.url),
    "utf8",
  );

  it("requires a dedicated server-side run token", () => {
    expect(source).toContain("AJG_RUN_TOKEN");
    expect(source).toContain("status: 401");
  });

  it("allows only deterministic low-risk actions", () => {
    expect(source).toContain('"support_reconcile"');
    expect(source).toContain('"support_remediation_sweep"');
    expect(source).toContain('"storage_backup"');
    expect(source).not.toContain("stripe");
    expect(source).not.toContain("delete");
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyManagedRepair } from "./support-remediation";
import { verifySupportTicketInRun } from "./run-intake-reporting";

// One owned disposable site only. No global RUN sweep or unrelated ticket mutation.
export async function runCustomerSupportE2E(input: {
  service: SupabaseClient; origin: string; customerToken: string; adminToken: string;
  userId: string; siteId: string; slug: string; publicMarker: string;
}) {
  const { service, siteId, userId } = input;
  async function call(path: string, method: string, body: unknown, admin = false) {
    const response = await fetch(new URL(path, input.origin), {
      method, headers: { Authorization: `Bearer ${admin ? input.adminToken : input.customerToken}`,
        "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store", signal: AbortSignal.timeout(20000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`customer_support_http_${response.status}`);
    return result;
  }
  // Simulate a safe database-only defect on the recipe's domain, without DNS mutations.
  const changed = await service.from("domains").update({ is_primary: false })
    .eq("site_id", siteId).eq("kind", "managed_subdomain").select("id,is_primary").single();
  if (changed.error || changed.data?.is_primary !== false) throw new Error("support_fixture_unconfirmed");
  const id = crypto.randomUUID();
  const created = await call("/api/support/tickets", "POST", {
    requestId: id, siteId, category: "domain", subject: "Disposable E2E domain repair",
    message: "Isolated technical recipe: verify and repair the temporary site's missing primary domain."
  });
  if (created?.ticket?.id !== id || created.ticket.site_id !== siteId ||
      !created.health?.diagnosis?.repairActions?.includes("managed_domain_repair")) {
    throw new Error("support_diagnosis_unconfirmed");
  }
  const intakeId = created?.runReceipt?.requestId;
  if (created?.runReceipt?.confirmed !== true || created.runReceipt.auditRecorded !== true ||
      typeof intakeId !== "string" || !/^req_[0-9a-f]{8}$/.test(intakeId)) {
    throw new Error("support_central_receipt_unconfirmed");
  }
  if (!(await verifySupportTicketInRun(id, intakeId))) throw new Error("support_central_readback_unconfirmed");
  const repaired = await call("/api/support/remediate", "POST", {
    siteId, ticketId: id, action: "managed_domain_repair"
  });
  if (repaired?.result?.status !== "succeeded" || repaired.result.verified !== true ||
      repaired.result.audited !== true || !(await verifyManagedRepair(service, { userId, siteId }))) {
    throw new Error("support_repair_unconfirmed");
  }
  const publicResponse = await fetch(new URL(`/site/${input.slug}`, input.origin), {
    cache: "no-store", signal: AbortSignal.timeout(15000)
  });
  if (!publicResponse.ok || !(await publicResponse.text()).includes(input.publicMarker)) {
    throw new Error("support_public_result_unconfirmed");
  }
  // Exercise the actual operator closure, only after independent repair/readback.
  const closed = await call("/api/admin/support", "PATCH", {
    id, status: "closed", resolutionCode: "e2e_verified_managed_primary_repair"
  }, true);
  if (closed?.ticket?.id !== id || closed.ticket.status !== "closed") {
    throw new Error("support_closure_unconfirmed");
  }
  const customer = await call("/api/support/tickets", "GET", null);
  if (!customer?.tickets?.some((ticket: { id: string; status: string }) =>
    ticket.id === id && ticket.status === "closed")) throw new Error("support_customer_readback_failed");
  const [events, repairs] = await Promise.all([
    service.from("support_ticket_events").select("event_type,actor_type,metadata").eq("ticket_id", id),
    service.from("support_remediation_runs").select("status,result_code").eq("ticket_id", id)
  ]);
  if (events.error || repairs.error ||
      !events.data?.some(row => row.event_type === "created" && row.actor_type === "client") ||
      !events.data?.some(row => row.event_type === "diagnostic" && row.actor_type === "system" &&
        row.metadata?.source === "ajg-run-intake" && row.metadata?.request_id === intakeId) ||
      !events.data?.some(row => row.event_type === "resolution" && row.actor_type === "admin" && row.metadata?.status === "closed") ||
      !repairs.data?.some(row => row.status === "succeeded" && row.result_code === "managed_domain_primary_repaired")) {
    throw new Error("support_durable_evidence_unconfirmed");
  }
  return { ticketId: id, centralReceiptVerified: true, centralRequestId: intakeId, repairVerified: true, closure: "operator" as const,
    centralCockpitVerified: true, automaticClosureVerified: false };
}

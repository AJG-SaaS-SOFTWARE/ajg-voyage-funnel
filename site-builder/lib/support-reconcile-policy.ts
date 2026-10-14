import type { SupportCheck, SupportCheckStatus } from "./support-diagnostics";

const supportedCauses: Record<string, readonly SupportCheck["key"][]> = {
  domain: ["domain"],
  publication: ["publication", "public_render", "sitemap"]
};

// A green service is not proof that a refund, copy problem or feature request is solved.
// Only recover a previously observed technical cause in a supported ticket category.
export function supportRecoveryIsVerified(input: {
  category?: string;
  previousDiagnosis?: unknown;
  checks?: SupportCheck[];
}): boolean {
  const keys = supportedCauses[input.category || ""];
  const previous = input.previousDiagnosis as { checks?: unknown } | null;
  if (!keys || !Array.isArray(previous?.checks) || !Array.isArray(input.checks)) return false;
  const failedChecks = previous.checks.filter((check): check is SupportCheck =>
    check && typeof check === "object" &&
    keys.includes(check.key) && ["action", "incident"].includes(check.status)
  );
  if (!failedChecks.length) return false;
  const healthy = (key: SupportCheck["key"]) =>
    input.checks!.some(check => check.key === key && check.status === "healthy") &&
    !input.checks!.some(check => check.key === key && check.status !== "healthy");
  return healthy("backend") && healthy("public_render") &&
    failedChecks.every(check => healthy(check.key));
}

export function supportCustomerAction(category: string, checks: SupportCheck[]): string | null {
  const keys: Record<string, readonly SupportCheck["key"][]> = {
    ...supportedCauses, billing: ["billing"], ai: ["ai"]
  };
  const applicable = keys[category];
  if (!applicable || !Array.isArray(checks)) return null;
  return checks.find(check => applicable.includes(check.key) &&
    check.status === "action" && check.clientAction)?.clientAction || null;
}

export type SupportReconcileDecision = {
  status: "waiting_customer" | "diagnosed" | "resolved";
  severity?: "normal" | "high";
  resolutionCode: string | null;
  resolved: boolean;
};

export function supportReconcileDecision(input: {
  overall: SupportCheckStatus;
  clientAction: string | null;
  ageHours: number;
  category?: string;
  previousDiagnosis?: unknown;
  checks?: SupportCheck[];
}): SupportReconcileDecision {
  if (input.overall === "healthy" && supportRecoveryIsVerified(input)) {
    return {
      status: "resolved",
      resolutionCode: "auto_health_recovered",
      resolved: true
    };
  }

  if (input.overall === "incident") {
    return {
      status: "diagnosed",
      severity: "high",
      resolutionCode: null,
      resolved: false
    };
  }

  if (!input.clientAction || input.ageHours >= 72) {
    return {
      status: "diagnosed",
      severity: "normal",
      resolutionCode: null,
      resolved: false
    };
  }

  return {
    status: "waiting_customer",
    resolutionCode: null,
    resolved: false
  };
}

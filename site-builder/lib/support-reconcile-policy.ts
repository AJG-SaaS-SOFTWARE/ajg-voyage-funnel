import type { SupportCheckStatus } from "./support-diagnostics";

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
}): SupportReconcileDecision {
  if (input.overall === "healthy") {
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

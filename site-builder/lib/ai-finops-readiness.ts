export type AiFinopsReadinessStatus = "pass" | "warn" | "blocker";

export function aiFinopsPolicyReadiness(input: {
  aiEnabled: boolean;
  heavyEnabled: boolean;
  globalDailyMicros: number;
  globalMonthlyMicros: number;
}): { status: AiFinopsReadinessStatus; detail: string } {
  const daily = Number(input.globalDailyMicros);
  const monthly = Number(input.globalMonthlyMicros);

  if (!Number.isFinite(daily) || daily <= 0 || !Number.isFinite(monthly) || monthly <= 0) {
    return {
      status: "blocker",
      detail: "Les plafonds globaux IA journalier ou mensuel sont absents ou invalides."
    };
  }

  if (!input.aiEnabled || !input.heavyEnabled) {
    return {
      status: "blocker",
      detail: `Breakers IA actifs : IA ${input.aiEnabled ? "active" : "suspendue"} · opérations lourdes ${input.heavyEnabled ? "actives" : "suspendues"}.`
    };
  }

  return {
    status: "pass",
    detail: `Plafonds actifs : ${(daily / 1_000_000).toFixed(2)} $ / jour · ${(monthly / 1_000_000).toFixed(2)} $ / mois.`
  };
}

export function aiFinopsMonitorReadiness(
  input: { lastRunAt: string | null; activeAlerts: number },
  nowMs = Date.now()
): { status: AiFinopsReadinessStatus; detail: string; ageHours: number | null } {
  const lastRunMs = input.lastRunAt ? Date.parse(input.lastRunAt) : Number.NaN;
  if (!Number.isFinite(lastRunMs)) {
    return {
      status: "blocker",
      detail: "Aucun passage valide du monitor FinOps IA n’est enregistré.",
      ageHours: null
    };
  }

  const ageHours = Math.max(0, (nowMs - lastRunMs) / 3_600_000);
  const activeAlerts = Math.max(0, Number(input.activeAlerts) || 0);

  if (ageHours > 48) {
    return {
      status: "blocker",
      detail: `Monitor FinOps obsolète : dernier passage il y a ${ageHours.toFixed(1)} h.`,
      ageHours
    };
  }

  if (ageHours > 26) {
    return {
      status: "warn",
      detail: `Monitor FinOps en retard : dernier passage il y a ${ageHours.toFixed(1)} h · ${activeAlerts} alerte(s) active(s).`,
      ageHours
    };
  }

  if (activeAlerts > 0) {
    return {
      status: "warn",
      detail: `Monitor FinOps récent (${ageHours.toFixed(1)} h) mais ${activeAlerts} alerte(s) budgétaire(s) active(s).`,
      ageHours
    };
  }

  return {
    status: "pass",
    detail: `Monitor FinOps récent (${ageHours.toFixed(1)} h), aucune alerte budgétaire active.`,
    ageHours
  };
}

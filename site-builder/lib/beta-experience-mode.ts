export type BetaExperienceMode = "essential" | "growth" | "architect";

const STORAGE_KEY = "eltara_beta_experience_mode_v1";

export function readBetaExperienceMode(): BetaExperienceMode {
  if (typeof window === "undefined") return "essential";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "growth" || stored === "architect" ? stored : "essential";
  } catch {
    return "essential";
  }
}

export function writeBetaExperienceMode(mode: BetaExperienceMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // The beta simulation remains usable for the current page even if storage is unavailable.
  }
}

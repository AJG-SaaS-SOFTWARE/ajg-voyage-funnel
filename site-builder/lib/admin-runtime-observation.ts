type RuntimeObservation = {
  checked: unknown;
  status: unknown;
  truncated: unknown;
};

// Partial logs can prove an observed warning/incident, never the absence of
// errors. Unavailable or unchecked observations must not become a green zero.
export function adminRuntimeObservation(runtime: RuntimeObservation | null | undefined) {
  if (runtime?.checked !== true) return "unknown" as const;
  if (runtime.status === "incident" || runtime.status === "warning") return runtime.status;
  return runtime.status === "healthy" && runtime.truncated === false
    ? "healthy" as const
    : "unknown" as const;
}

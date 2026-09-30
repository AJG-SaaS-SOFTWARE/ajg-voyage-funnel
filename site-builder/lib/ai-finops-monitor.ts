import { createClient } from "@supabase/supabase-js";

// Called only after an existing scheduled endpoint has verified CRON_SECRET.
// No provider call, email, extra schedule or billing mutation is performed.
export async function runAiFinopsMonitorSafely(): Promise<{ ok: boolean; activeAlerts?: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return { ok: false };
  try {
    const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await service.rpc("run_ai_finops_monitor");
    if (error || data?.ok !== true) throw new Error("finops_monitor_failed");
    return { ok: true, activeAlerts: Number(data.activeAlerts) || 0 };
  } catch {
    console.warn("ai_finops_monitor_failed");
    return { ok: false };
  }
}

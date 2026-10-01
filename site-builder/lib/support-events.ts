import type { SupabaseClient } from "@supabase/supabase-js";

export type SupportEventActor = "client" | "system" | "admin";
export type SupportEventType = "created" | "diagnostic" | "status" | "note" | "resolution";

function safeMetadata(value: Record<string, unknown> | undefined) {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) =>
        /^[a-z0-9_]{1,40}$/i.test(key)
        && (item === null
          || typeof item === "string"
          || typeof item === "number"
          || typeof item === "boolean")
      )
      .slice(0, 12)
  );
}

export async function recordSupportEvent(
  service: SupabaseClient,
  input: {
    ticketId: string;
    actor: SupportEventActor;
    type: SupportEventType;
    message?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const message =
    typeof input.message === "string"
      ? input.message.trim().slice(0, 2000) || null
      : null;

  const { error } = await service.from("support_ticket_events").insert({
    ticket_id: input.ticketId,
    actor_type: input.actor,
    event_type: input.type,
    message,
    metadata: safeMetadata(input.metadata)
  });

  if (error) {
    console.error("Support event audit failed", {
      ticketId: input.ticketId,
      actor: input.actor,
      type: input.type,
      code: error.code || "unknown"
    });
    return false;
  }

  return true;
}

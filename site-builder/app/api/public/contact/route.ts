import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorCode(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : String(error || "");
  for (const code of ["rate_limited", "consent_required", "invalid_contact_message", "site_not_available"]) {
    if (message.includes(code)) return code;
  }
  return "contact_unavailable";
}

function fingerprint(request: Request, siteId: string, secret: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const realIp = request.headers.get("x-real-ip")?.trim() || "";
  const agent = request.headers.get("user-agent")?.slice(0, 300) || "";
  return createHmac("sha256", secret)
    .update(`${siteId}|${forwarded || realIp || "unknown"}|${agent}`)
    .digest("hex");
}

async function notifyConfiguredRecipient(args: {
  service: SupabaseClient<any>;
  siteId: string;
  messageId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
}) {
  const resend = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) return false;

  const { data: site } = await args.service
    .from("sites")
    .select("brand_name,first_name,last_name,design_assets")
    .eq("id", args.siteId)
    .maybeSingle();
  const recipient = String((site as any)?.design_assets?.modules?.contact?.email || "").trim();
  if (!EMAIL.test(recipient)) return false;

  const brand = String((site as any)?.brand_name || `${(site as any)?.first_name || ""} ${(site as any)?.last_name || ""}`).trim() || "ELTARA";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `contact-${args.messageId}`
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      reply_to: args.senderEmail,
      subject: `[${brand}] Nouveau message${args.subject ? ` — ${args.subject}` : ""}`,
      text: [
        `Nouveau message reçu depuis le site ${brand}.`,
        "",
        `Nom : ${args.senderName}`,
        `E-mail : ${args.senderEmail}`,
        args.subject ? `Objet : ${args.subject}` : "",
        "",
        args.message,
        "",
        "Ce message a été transmis par le formulaire public ELTARA."
      ].filter(Boolean).join("\n")
    })
  });
  return response.ok;
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 12000) {
    return NextResponse.json({ error: "invalid_contact_message" }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_contact_message" }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true, notification: "suppressed" });
  }

  const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
  const senderName = typeof body.name === "string" ? body.name.trim() : "";
  const senderEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const consent = body.consent === true;

  if (
    !UUID.test(siteId)
    || senderName.length < 1 || senderName.length > 100
    || !EMAIL.test(senderEmail) || senderEmail.length > 254
    || subject.length > 160
    || message.length < 10 || message.length > 4000
  ) {
    return NextResponse.json({ error: "invalid_contact_message" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "consent_required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishable || !serviceKey) {
    return NextResponse.json({ error: "contact_unavailable" }, { status: 503 });
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: site, error: siteError } = await service
    .from("sites")
    .select("id,status,public_access_state,privacy_state,design_assets")
    .eq("id", siteId)
    .maybeSingle();

  const contact = (site as any)?.design_assets?.modules?.contact;
  const configuredEmail = typeof contact?.email === "string" ? contact.email.trim() : "";
  if (
    siteError || !site
    || (site as any).status !== "published"
    || (site as any).public_access_state !== "live"
    || (site as any).privacy_state !== "active"
  ) {
    return NextResponse.json({ error: "site_not_available" }, { status: 404 });
  }
  if (contact?.enabled !== true || !EMAIL.test(configuredEmail)) {
    return NextResponse.json({ error: "contact_disabled" }, { status: 404 });
  }

  const anonymous = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: messageId, error } = await anonymous.rpc("submit_contact_message", {
    p_site_id: siteId,
    p_sender_name: senderName,
    p_sender_email: senderEmail,
    p_subject: subject,
    p_message: message,
    p_consent: true,
    p_abuse_fingerprint: fingerprint(request, siteId, serviceKey)
  });

  if (error || !messageId) {
    const code = errorCode(error);
    return NextResponse.json(
      { error: code },
      { status: code === "rate_limited" ? 429 : code === "site_not_available" ? 404 : 400 }
    );
  }

  let notified = false;
  try {
    notified = await notifyConfiguredRecipient({
      service,
      siteId,
      messageId: String(messageId),
      senderName,
      senderEmail,
      subject,
      message
    });
  } catch (notificationError) {
    console.error("Contact notification failed", {
      siteId,
      messageId,
      error: notificationError instanceof Error ? notificationError.message : "unknown"
    });
  }

  return NextResponse.json(
    { ok: true, id: messageId, notification: notified ? "sent" : "stored" },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}

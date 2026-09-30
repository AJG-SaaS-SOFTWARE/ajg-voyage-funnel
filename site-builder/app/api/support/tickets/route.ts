import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildSupportDiagnosis, type SupportDiagnosis } from "../../../../lib/support-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const categories = new Set(["bug","domain","publication","billing","ai","data","other"]);

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

async function context(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = bearer(request);
  if (!url || !publishable || !serviceKey) return { response: NextResponse.json({ error: "Support indisponible." }, { status: 503 }) };
  if (!token) return { response: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return { response: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { user, service };
}

async function diagnose(service: SupabaseClient, userId: string, preferredSiteId?: string | null): Promise<{ siteId: string | null; diagnosis: SupportDiagnosis }> {
  let siteQuery = service
    .from("sites")
    .select("id,slug,status,public_access_state,owner_id,created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (preferredSiteId) {
    siteQuery = service
      .from("sites")
      .select("id,slug,status,public_access_state,owner_id,created_at")
      .eq("owner_id", userId)
      .eq("id", preferredSiteId)
      .limit(1);
  }

  const { data: siteRows, error: siteError } = await siteQuery;
  if (siteError) {
    return {
      siteId: null,
      diagnosis: buildSupportDiagnosis({ backendOk: false, site: null, domains: [], billingState: null })
    };
  }

  const site = siteRows?.[0] || null;
  if (!site) {
    return {
      siteId: null,
      diagnosis: buildSupportDiagnosis({ backendOk: true, site: null, domains: [], billingState: null })
    };
  }

  const [{ data: domains, error: domainError }, { data: billing, error: billingError }] = await Promise.all([
    service
      .from("domains")
      .select("hostname,verification_status,is_primary")
      .eq("site_id", site.id),
    service
      .from("site_billing_states")
      .select("state")
      .eq("site_id", site.id)
      .maybeSingle()
  ]);

  return {
    siteId: site.id,
    diagnosis: buildSupportDiagnosis({
      backendOk: !domainError && !billingError,
      site: {
        id: site.id,
        slug: site.slug,
        status: site.status,
        publicAccessState: site.public_access_state
      },
      domains: (domains || []).map((domain) => ({
        hostname: domain.hostname,
        verificationStatus: domain.verification_status,
        isPrimary: domain.is_primary
      })),
      billingState: billing?.state || null
    })
  };
}

export async function GET(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;

  const [{ data: tickets, error: ticketError }, health] = await Promise.all([
    auth.service
      .from("support_tickets")
      .select("id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    diagnose(auth.service, auth.user.id)
  ]);

  if (ticketError) return NextResponse.json({ error: "Tickets indisponibles." }, { status: 503 });
  return NextResponse.json({ health, tickets: tickets || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await context(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category : "other";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const preferredSiteId = typeof body?.siteId === "string" ? body.siteId : null;

  if (!categories.has(category) || subject.length < 3 || subject.length > 160 || message.length < 10 || message.length > 4000) {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }

  const health = await diagnose(auth.service, auth.user.id, preferredSiteId);
  const incident = health.diagnosis.overall === "incident";
  const waitingCustomer = !incident && health.diagnosis.overall === "action";
  const status = waitingCustomer ? "waiting_customer" : "diagnosed";
  const severity = incident ? "high" : "normal";

  const { data: ticket, error } = await auth.service
    .from("support_tickets")
    .insert({
      user_id: auth.user.id,
      site_id: health.siteId,
      category,
      severity,
      subject,
      message,
      status,
      diagnosis: health.diagnosis,
      client_action: health.diagnosis.clientAction
    })
    .select("id,site_id,category,severity,subject,message,status,diagnosis,client_action,resolution_code,created_at,updated_at,resolved_at")
    .single();

  if (error || !ticket) return NextResponse.json({ error: "Création du ticket impossible." }, { status: 503 });
  return NextResponse.json({ ticket, health }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

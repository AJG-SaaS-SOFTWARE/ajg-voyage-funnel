const MAX_BODY_BYTES = 8_000;
const ALLOWED_ORIGINS = new Set([
  "https://voyage.ajgsolutionsgroup.com",
  "https://www.voyage.ajgsolutionsgroup.com"
]);
const ALLOWED_EVENTS = new Set([
  "questionnaire_started",
  "questionnaire_completed",
  "lead_submitted",
  "calendly_clicked"
]);

function clean(value, max = 250) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const origin = clean(req.headers.origin, 500);
  const isPreview = /^https:\/\/ajg-voyage-[a-z0-9-]+-ajg-saas-software\.vercel\.app$/i.test(origin);
  if (origin && !ALLOWED_ORIGINS.has(origin) && !isPreview) return json(res, 403, { error: "Origin not allowed" });\n  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();\n  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") return json(res, 403, { error: "Cross-site request not allowed" });
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return json(res, 415, { error: "Unsupported media type" });
  if (Number(req.headers["content-length"] || 0) > MAX_BODY_BYTES) return json(res, 413, { error: "Payload too large" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const eventName = clean(body.event_name, 64);

  const language = body.language === "en" ? "en" : "fr";
  if (!ALLOWED_EVENTS.has(eventName)) {
    return json(res, 400, { error: "Invalid event" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return json(res, 503, { error: "Analytics unavailable" });

  const row = {

    event_name: eventName,
    language,
    page_path: clean(body.page_path, 500) || "/",
    utm_source: clean(body.utm_source) || null,
    utm_medium: clean(body.utm_medium) || null,
    utm_campaign: clean(body.utm_campaign) || null
  };

  const insert = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/ajg_voyage_funnel_events`, {
    method: "POST",
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row)
  });
  if (!insert.ok) return json(res, 502, { error: "Analytics storage failed" });
  return json(res, 200, { ok: true });
}

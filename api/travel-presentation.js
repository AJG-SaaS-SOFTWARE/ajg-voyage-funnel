const MAX_BODY_BYTES = 32_000;
const ALLOWED_ORIGINS = new Set([
  "https://voyage.ajgsolutionsgroup.com",
  "https://www.voyage.ajgsolutionsgroup.com"
]);
const ALLOWED_INTERESTS = new Set(["Voyager plus avantageusement", "Découvrir l'activité", "Les deux", "Travel more advantageously", "Discover the referral activity", "Both"]);
const ALLOWED_FREQUENCIES = new Set(["0-1 fois par an", "2-3 fois par an", "4 fois ou plus par an", "Variable", "0-1 times per year", "2-3 times per year", "4 or more times per year", "It varies"]);
const ALLOWED_GOALS = new Set(["Voyage uniquement pour le moment", "Comprendre le fonctionnement", "Développer une activité indépendante", "Travel only for now", "Understand how it works", "Explore an independent activity"]);

function text(value, max = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function bool(value) {
  return value === true || value === "true" || value === "oui" || value === "yes" || value === "on";
}

function json(res, status, body) {
  res.status(status);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function sendNotification(row) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFICATION_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !to || !from) return;

  const subject = row.language === "en"
    ? `New AJG Voyage lead — ${row.first_name}`
    : `Nouveau prospect AJG Voyage — ${row.first_name}`;

  const lines = [
    `Prénom / First name: ${row.first_name}`,
    `Email: ${row.email}`,
    `Téléphone / Phone: ${row.phone || "—"}`,
    `Langue / Language: ${row.language}`,
    `Intérêt / Interest: ${row.main_interest}`,
    `Fréquence voyage / Travel frequency: ${row.travel_frequency}`,
    `Objectif activité / Activity goal: ${row.activity_goal}`,
    `Score: ${row.lead_score}`,
    `Consentement marketing / Marketing consent: ${row.marketing_consent ? "oui/yes" : "non/no"}`,
    `Source: ${row.utm_source || "—"}`,
    `Campaign: ${row.utm_campaign || "—"}`,
    `Landing: ${row.landing_url || "—"}`
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: lines.join("\n")
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Resend notification failed", response.status, detail.slice(0, 500));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const origin = text(req.headers.origin, 500);
  const isPreview = /^https:\/\/[-a-z0-9]+\.vercel\.app$/i.test(origin);
  if (origin && !ALLOWED_ORIGINS.has(origin) && !isPreview) {
    return json(res, 403, { error: "Origin not allowed" });
  }

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return json(res, 415, { error: "Unsupported media type" });
  }

  const declaredLength = Number(req.headers["content-length"] || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json(res, 413, { error: "Payload too large" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};

  // Honeypot: answer successfully without storing anything.
  if (text(body.bot_field || body["bot-field"], 120)) {
    return json(res, 200, { ok: true });
  }

  const firstName = text(body.prenom, 100);
  const email = text(body.email, 254).toLowerCase();
  const phone = text(body.telephone, 50);
  const language = text(body.language, 5) === "en" ? "en" : "fr";
  const mainInterest = text(body.interet_principal, 200);
  const travelFrequency = text(body.frequence_voyage, 200);
  const activityGoal = text(body.objectif_activite, 250);
  const leadScore = Math.max(0, Math.min(100, Number.parseInt(body.lead_score, 10) || 0));

  if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: "Invalid contact details" });
  }
  if (!mainInterest || !travelFrequency || !activityGoal) {
    return json(res, 400, { error: "Incomplete qualification" });
  }
  if (!ALLOWED_INTERESTS.has(mainInterest) || !ALLOWED_FREQUENCIES.has(travelFrequency) || !ALLOWED_GOALS.has(activityGoal)) {
    return json(res, 400, { error: "Invalid qualification values" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("AJG Voyage lead storage is not configured.");
    return json(res, 503, { error: "Lead service unavailable" });
  }

  const row = {
    first_name: firstName,
    email,
    phone: phone || null,
    language,
    main_interest: mainInterest,
    travel_frequency: travelFrequency,
    activity_goal: activityGoal,
    marketing_consent: bool(body.consentement_marketing),
    contact_request: true,
    lead_score: leadScore,
    utm_source: text(body.utm_source, 250) || null,
    utm_medium: text(body.utm_medium, 250) || null,
    utm_campaign: text(body.utm_campaign, 250) || null,
    utm_content: text(body.utm_content, 250) || null,
    utm_term: text(body.utm_term, 250) || null,
    landing_url: text(body.landing_url, 1500) || null,
    referrer_url: text(body.referrer_url, 1500) || null
  };

  const insert = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/ajg_voyage_leads`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(row)
  });

  if (!insert.ok) {
    const detail = await insert.text().catch(() => "");
    console.error("Supabase lead insert failed", insert.status, detail.slice(0, 500));
    return json(res, 502, { error: "Lead storage failed" });
  }

  try {
    await sendNotification(row);
  } catch (error) {
    // The lead is already safely stored. Notification failure must not lose it.
    console.error("Lead notification error", error);
  }

  return json(res, 200, { ok: true });
}

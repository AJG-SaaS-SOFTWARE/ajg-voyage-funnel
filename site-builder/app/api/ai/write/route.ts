import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const writableFields = {
  heroTagline: {
    name: "la petite phrase située au-dessus du titre",
    purpose: "Create a distinctive micro-hook that sets the mood and complements the headline instead of repeating it.",
    constraint: "Une seule phrase très courte, 90 caractères maximum."
  },
  heroTitle: {
    name: "le titre principal de la page d'accueil",
    purpose: "Make the visitor understand the promise or point of view immediately. Prefer a memorable human headline over generic marketing language.",
    constraint: "Un titre clair et naturel, idéalement 4 à 10 mots, 90 caractères maximum."
  },
  heroSubtitle: {
    name: "l'introduction sous le titre principal",
    purpose: "Clarify the headline with concrete personal context and give the visitor a reason to keep reading, without overselling.",
    constraint: "Deux ou trois phrases courtes, simples et humaines, 420 caractères maximum."
  },
  aboutHeading: {
    name: "le titre de la rubrique de présentation personnelle",
    purpose: "Introduce the person naturally and create continuity with the site's tone. Avoid generic labels when a more personal title is supported by context.",
    constraint: "Un titre court, naturel, 100 caractères maximum."
  },
  aboutText: {
    name: "la présentation personnelle",
    purpose: "Sound like the person speaking to a visitor: specific, credible and warm. Use supplied personal details selectively rather than listing them.",
    constraint: "Un texte humain de 70 à 130 mots, en paragraphes courts si utile."
  },
  guidedDraft: {
    name: "l'ensemble des textes principaux du site",
    purpose: "Transform short, fragmentary guided answers into polished, coherent website copy. Build complete sentences and a clear narrative without inventing facts.",
    constraint: "Return exactly five fields in the requested JSON structure: heroTagline, heroTitle, heroSubtitle, aboutHeading, aboutText."
  },
  qualityReview: {
    name: "la relecture du site",
    purpose: "Check French or English spelling, grammar, editorial coherence, unnecessary repetition, marketing clarity, reader benefit and call to action. Recommend only meaningful changes, avoid hype and preserve every factual claim.",
    constraint: "Return JSON with issues and suggested field replacements, never overwrite user content."
  },
  bookingLabel: {
    name: "le texte du bouton de prise de rendez-vous",
    purpose: "Give a clear, low-pressure next action. Avoid hype, urgency and vague calls to action.",
    constraint: "Une formulation d'action très courte, 45 caractères maximum."
  }
} as const;

type WritableField = keyof typeof writableFields;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function authenticatedContext(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!url || !key || !token) return null;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, supabase };
}

async function consumeAiAllowance(userId: string, supabase: any) {
  const { data, error } = await supabase.rpc("consume_ai_generation", {
    p_user_id: userId,
    p_minute_limit: 5,
    p_daily_limit: 50,
    p_monthly_limit: 200
  });
  if (error) throw error;
  return typeof data === "string" ? data : "unavailable";
}

function extractText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return "";
}

export async function POST(request: Request) {
  const auth = await authenticatedContext(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Reconnectez-vous avant d'utiliser l'assistant IA." },
      { status: 401 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "L'assistant IA n'est pas encore activé sur cet environnement." },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }

  const field = body?.field as WritableField;
  if (!field || !(field in writableFields)) {
    return NextResponse.json({ error: "Ce champ n'est pas compatible avec l'assistant IA." }, { status: 400 });
  }

  const instruction = clean(body?.instruction, 800);
  if (!instruction) {
    return NextResponse.json({ error: "Décrivez le texte que vous souhaitez obtenir." }, { status: 400 });
  }

  let allowance: string;
  try {
    allowance = await consumeAiAllowance(auth.user.id, auth.supabase);
  } catch (error) {
    console.error("AI allowance check failed", error);
    return NextResponse.json({ error: "L'assistant IA est temporairement indisponible. Réessayez dans quelques instants." }, { status: 503 });
  }
  if (allowance !== "ok") {
    const message = allowance === "minute_limit"
      ? "Vous avez effectué plusieurs demandes très rapidement. Attendez une minute avant de réessayer."
      : allowance === "daily_limit"
        ? "Votre limite IA du jour est atteinte. Vous pourrez à nouveau utiliser l'assistant demain."
        : allowance === "monthly_limit"
          ? "Votre quota IA mensuel est atteint. Il sera renouvelé au début du mois prochain."
          : "L'assistant IA est temporairement indisponible.";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const currentText = clean(body?.currentText, 3500);
  const context = body?.context && typeof body.context === "object" ? body.context : {};
  const language = context.language === "en" ? "English" : "French";
  const affiliation = context.affiliation === "independent" ? "independent" : "mwr";
  const firstName = clean(context.firstName, 80);
  const brandName = clean(context.brandName, 120);
  const rawSiteContext = context.siteContext && typeof context.siteContext === "object" ? context.siteContext : {};
  const contextEntries = [
    ["tagline", clean(rawSiteContext.heroTagline, 120)],
    ["headline", clean(rawSiteContext.heroTitle, 140)],
    ["intro", clean(rawSiteContext.heroSubtitle, 500)],
    ["about heading", clean(rawSiteContext.aboutHeading, 140)],
    ["about", clean(rawSiteContext.aboutText, 900)],
    ["booking button", clean(rawSiteContext.bookingLabel, 100)],
    ["traveler profile", clean(rawSiteContext.guidedTraveler, 220)],
    ["discovery", clean(rawSiteContext.guidedDiscovery, 220)],
    ["benefit", clean(rawSiteContext.guidedBenefit, 220)],
    ["audience", clean(rawSiteContext.guidedAudience, 220)]
  ].filter(([, value]) => value && value !== currentText);
  const selectedContextEntries = field === "guidedDraft"
    ? contextEntries.filter(([key]) => ["traveler profile", "discovery", "benefit", "audience"].includes(key))
    : field === "qualityReview"
      ? contextEntries.slice(0, 10)
      : contextEntries.slice(0, 6);
  const editorialContext = selectedContextEntries
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const fieldSpec = writableFields[field];

  const complianceRules = affiliation === "mwr"
    ? "The member is an independent MWR Life Lifestyle Ambassador. Do not present the site as official. Do not invent prices, discounts, savings, guarantees, income claims, affiliations, certifications or product capabilities. Mention MWR Life or Travel Advantage only when the user's request or existing text makes it relevant."
    : "This is an independent site. Do not introduce MWR Life or Travel Advantage unless they already appear in the user's request. Do not invent affiliations, certifications, guarantees, prices, savings, income claims or product capabilities.";

  const prompt = [
    `Field to write: ${fieldSpec.name}.`,
    `Goal: ${fieldSpec.purpose}`,
    `Hard constraint: ${fieldSpec.constraint}`,
    `Language: ${language}.`,
    firstName ? `First name: ${firstName}.` : "",
    brandName ? `Site/brand name: ${brandName}.` : "",
    editorialContext ? `Relevant site context:\n${editorialContext}` : "",
    currentText ? `Current editable text: ${currentText}` : "No current text.",
    `User request: ${instruction}`,
    field === "qualityReview"
      ? "Return ONLY valid JSON: {\"issues\":[{\"field\":\"heroTitle\",\"reason\":\"brief actionable reason\"}],\"suggestions\":{\"heroTitle\":\"corrected full field text\"}}. Allowed field keys: heroTagline, heroTitle, heroSubtitle, aboutHeading, aboutText, bookingLabel. Check spelling, grammar, coherence between fields, redundant ideas, clarity of the visitor benefit, credibility of marketing language and the CTA. Prefer concrete natural wording over hype or generic claims. Include a suggestion only for an actual error or worthwhile editorial improvement. Maximum six issues. Preserve facts and never invent claims. If all is good, return empty arrays and object."
      : field === "guidedDraft"
      ? "Return ONLY valid JSON with keys heroTagline, heroTitle, heroSubtitle, aboutHeading, aboutText. Treat the guided answers as notes, not copy to paste. Turn even one or two keywords into fluent complete sentences, but never invent facts. Give each field a distinct role: heroTagline = very short mood/angle; heroTitle = clear memorable promise or point of view; heroSubtitle = 2 or 3 sentences explaining what the visitor will discover; aboutHeading = personal section title; aboutText = 70 to 130 words connecting the person's travel profile, discovery and motivation naturally. Use the audience answer only if it was supplied. Avoid repeating the same phrase, benefit or opening across fields. Every prose sentence must begin with a capital letter and be grammatically complete. Use a polished, natural, moderately formal register by default; the user can simplify it later."
      : "Write only the final text that can be inserted directly into the field. No quotation marks, headings, explanations, markdown or alternatives."
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna",
      instructions: [
        "You write concise website copy for non-expert users.",
        "Infer sensible writing intent from the field goal and supplied site context when the user's request is vague.",
        "Prefer specific details already supplied by the user over generic marketing language. Do not mechanically repeat context or duplicate nearby fields.",
        "Preserve the person's voice and facts. Avoid clichés, hype and generic AI copy. Never invent factual claims.",
        "The final copy must have impeccable spelling, grammar, punctuation and typography in the requested language. Silently correct any language errors present in source text.",
        "Never paste raw notes or fragments as sentences. Convert keywords and telegraphic answers into fluent, complete sentences with an initial capital letter.",
        "Default to polished, structured, moderately formal prose while remaining natural and credible.",
        complianceRules
      ].join(" "),
      input: prompt,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      max_output_tokens: field === "guidedDraft" ? 650 : field === "qualityReview" ? 800 : field === "aboutText" ? 320 : 140
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = data?.error?.code || "unknown";
    console.error("OpenAI text generation failed", { status: response.status, code });
    const unavailable = code === "credit_balance_exhausted" || code === "insufficient_quota";
    return NextResponse.json(
      {
        error: unavailable
          ? "L'assistant IA est momentanément indisponible. Votre demande n'a pas été générée."
          : response.status === 429
            ? "Le service IA reçoit trop de demandes. Réessayez dans quelques instants."
            : "L'IA n'a pas pu rédiger ce texte. Réessayez dans quelques instants."
      },
      { status: unavailable ? 503 : 502 }
    );
  }

  const text = extractText(data);
  if (!text) {
    return NextResponse.json(
      { error: "L'IA n'a pas renvoyé de texte exploitable. Reformulez votre demande." },
      { status: 502 }
    );
  }

  if (field === "qualityReview") {
    try {
      const parsed = JSON.parse(text.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, ""));
      const allowed = ["heroTagline", "heroTitle", "heroSubtitle", "aboutHeading", "aboutText", "bookingLabel"];
      const suggestions = Object.fromEntries(Object.entries(parsed.suggestions || {}).filter(([key, value]) => allowed.includes(key) && typeof value === "string" && value.trim()).map(([key, value]) => [key, clean(value, 3500)]));
      const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).filter((item: any) => allowed.includes(item?.field) && typeof item?.reason === "string").slice(0, 6).map((item: any) => ({ field: item.field, reason: clean(item.reason, 240) }));
      return NextResponse.json({ issues, suggestions });
    } catch {
      return NextResponse.json({ error: "La relecture n'a pas pu être structurée. Réessayez." }, { status: 502 });
    }
  }

  if (field === "guidedDraft") {
    try {
      const cleaned = text.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
      const draft = JSON.parse(cleaned);
      const required = ["heroTagline", "heroTitle", "heroSubtitle", "aboutHeading", "aboutText"];
      if (!required.every((key) => typeof draft[key] === "string" && draft[key].trim())) throw new Error("Incomplete guided draft");
      return NextResponse.json({ draft });
    } catch (error) {
      console.error("Invalid guided draft output", error);
      return NextResponse.json({ error: "L'IA n'a pas pu structurer les textes. Réessayez." }, { status: 502 });
    }
  }

  return NextResponse.json({ text });
}

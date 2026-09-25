import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const writableFields = {
  heroTagline: {
    name: "la petite phrase située au-dessus du titre",
    constraint: "Une seule phrase très courte, 90 caractères maximum."
  },
  heroTitle: {
    name: "le titre principal de la page d'accueil",
    constraint: "Un titre clair et naturel, idéalement 4 à 10 mots, 90 caractères maximum."
  },
  heroSubtitle: {
    name: "l'introduction sous le titre principal",
    constraint: "Deux ou trois phrases courtes, simples et humaines, 420 caractères maximum."
  },
  aboutHeading: {
    name: "le titre de la rubrique de présentation personnelle",
    constraint: "Un titre court, naturel, 100 caractères maximum."
  },
  aboutText: {
    name: "la présentation personnelle",
    constraint: "Un texte humain de 70 à 130 mots, en paragraphes courts si utile."
  },
  bookingLabel: {
    name: "le texte du bouton de prise de rendez-vous",
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

  let allowance: string;
  try {
    allowance = await consumeAiAllowance(auth.user.id, auth.supabase);
  } catch (error) {
    console.error("AI allowance check failed", error);
    return NextResponse.json(
      { error: "L'assistant IA est temporairement indisponible. Réessayez dans quelques instants." },
      { status: 503 }
    );
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

  const currentText = clean(body?.currentText, 3500);
  const context = body?.context && typeof body.context === "object" ? body.context : {};
  const language = context.language === "en" ? "English" : "French";
  const affiliation = context.affiliation === "independent" ? "independent" : "mwr";
  const firstName = clean(context.firstName, 80);
  const brandName = clean(context.brandName, 120);
  const fieldSpec = writableFields[field];

  const complianceRules = affiliation === "mwr"
    ? "The member is an independent MWR Life Lifestyle Ambassador. Do not present the site as official. Do not invent prices, discounts, savings, guarantees, income claims, affiliations, certifications or product capabilities. Mention MWR Life or Travel Advantage only when the user's request or existing text makes it relevant."
    : "This is an independent site. Do not introduce MWR Life or Travel Advantage unless they already appear in the user's request. Do not invent affiliations, certifications, guarantees, prices, savings, income claims or product capabilities.";

  const prompt = [
    `Field to write: ${fieldSpec.name}.`,
    `Hard constraint: ${fieldSpec.constraint}`,
    `Language: ${language}.`,
    firstName ? `First name: ${firstName}.` : "",
    brandName ? `Site/brand name: ${brandName}.` : "",
    currentText ? `Current editable text: ${currentText}` : "No current text.",
    `User request: ${instruction}`,
    "Write only the final text that can be inserted directly into the field. No quotation marks, headings, explanations, markdown or alternatives."
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
        "Follow the user's intent while keeping wording factual, natural and easy to understand.",
        "Never invent factual claims that were not supplied by the user.",
        complianceRules
      ].join(" "),
      input: prompt,
      max_output_tokens: field === "aboutText" ? 500 : 220
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

  return NextResponse.json({ text });
}

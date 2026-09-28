import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePremiumSiteArchitect, PremiumArchitectError } from "../../../../lib/premium-site-architect";

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
  siteRevision: {
    name: "une révision globale du site",
    purpose: "Revise an existing structured website from a natural-language request while preserving verified facts, rights-cleared assets, legal/system content and choices the user did not ask to change.",
    constraint: "Return the same structured JSON as siteArchitect. Never publish automatically and never invent facts, testimonials, numbers, prices, contact details, credentials, claims or asset IDs."
  },
  siteArchitect: {
    name: "un plan complet de site",
    purpose: "Turn a short business/activity brief and keywords into a coherent first website proposal: core copy, useful modules, CTA and a restrained visual direction. Never invent facts.",
    constraint: "Return only the exact JSON structure requested. The proposal is a draft and must never be published automatically."
  },
  moduleDraft: {
    name: "une rubrique facultative du site",
    purpose: "Prepare useful structured draft content for an optional website module from the user's business/activity brief and existing site context, while never inventing facts.",
    constraint: "Return only the JSON structure requested for the specified module type."
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

async function consumeAiAllowance(supabase: any, siteId: string) {
  const { data, error } = await supabase.rpc("consume_my_site_ai_generation", { p_site_id: siteId });
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

  let siteId = typeof body?.siteId === "string" ? body.siteId : "";
  if (!siteId) {
    const { data: ownedSites, error: siteError } = await auth.supabase.from("sites").select("id").eq("owner_id", auth.user.id).limit(2);
    if (siteError) return NextResponse.json({ error: "Impossible de vérifier les droits du site." }, { status: 503 });
    if ((ownedSites || []).length !== 1) return NextResponse.json({ error: "Le site concerné doit être identifié pour utiliser l’IA." }, { status: 400 });
    siteId = ownedSites![0].id;
  }
  const { data: capabilities, error: capabilityError } = await auth.supabase.rpc("get_my_site_capabilities", { p_site_id: siteId });
  if (capabilityError) return NextResponse.json({ error: "Impossible de vérifier les droits du site." }, { status: 503 });
  const capability = Array.isArray(capabilities) ? capabilities[0] : capabilities;
  if (!capability?.can_generate_ai) return NextResponse.json({ error: "Les fonctions IA sont temporairement indisponibles pour ce site. Vous pouvez régulariser l’accès depuis votre espace de facturation." }, { status: 402 });

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
  const moduleType = clean(context.moduleType, 30);
  const architectBrief = clean(context.architectBrief, 4000);
  const revisionRequest = clean(context.revisionRequest, 1200);
  const existingProposal = context.existingProposal && typeof context.existingProposal === "object" ? context.existingProposal : null;
  const moduleBrief = clean(context.moduleBrief, 1000);
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
    ["audience", clean(rawSiteContext.guidedAudience, 220)],
    ["module brief", moduleBrief],
    ["site architect brief", architectBrief]
  ].filter(([, value]) => value && value !== currentText);
  const selectedContextEntries = field === "siteArchitect" || field === "siteRevision"
    ? contextEntries.slice(0, 12)
    : field === "guidedDraft"
    ? contextEntries.filter(([key]) => ["traveler profile", "discovery", "benefit", "audience"].includes(key))
    : field === "moduleDraft"
      ? contextEntries.slice(0, 11)
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

  const modulePrompt = field === "moduleDraft"
    ? moduleType === "faq"
      ? "Module type: FAQ. Return ONLY valid JSON: {\"title\":\"...\",\"items\":[{\"question\":\"...\",\"answer\":\"...\"}]}. Produce 4 to 6 genuinely useful questions. Answers must rely only on supplied facts. Never invent prices, guarantees, savings, performance, legal claims or commercial conditions. Keep answers concise and natural."
      : moduleType === "benefits"
        ? "Module type: benefits. Return ONLY valid JSON: {\"title\":\"...\",\"items\":[{\"title\":\"...\",\"text\":\"...\"}]}. Produce 3 to 5 distinct benefits supported by supplied context. Describe visitor value concretely without hype or invented claims."
        : moduleType === "figures"
          ? "Module type: key figures. Return ONLY valid JSON: {\"title\":\"...\",\"items\":[{\"value\":\"\",\"label\":\"...\"}]}. Produce 3 to 5 useful categories the user could truthfully quantify. The value field MUST remain empty. Never invent any number, percentage, duration, revenue, customer count or statistic."
          : ""
    : "";

  if (field === "moduleDraft" && !["faq", "benefits", "figures"].includes(moduleType)) {
    return NextResponse.json({ error: "Cette rubrique n'est pas encore compatible avec l'assistant IA." }, { status: 400 });
  }

  if (field === "moduleDraft" && !moduleBrief) {
    return NextResponse.json({ error: "Décrivez d'abord votre activité ou l'objectif du site." }, { status: 400 });
  }

  if (field === "siteRevision" && (!revisionRequest || !existingProposal)) {
    return NextResponse.json({ error: "Décrivez la modification globale souhaitée sur le site actuel." }, { status: 400 });
  }

  if (field === "siteArchitect" && !architectBrief) {
    return NextResponse.json({ error: "Décrivez d'abord votre activité, votre objectif et quelques mots-clés." }, { status: 400 });
  }

  if (field === "siteArchitect" || field === "siteRevision") {
    const { data: entitlements, error: entitlementError } = await auth.supabase.rpc("get_my_site_entitlements", { p_site_id: siteId });
    if (entitlementError) return NextResponse.json({ error: "Impossible de vérifier votre offre." }, { status: 503 });
    const entitlement = Array.isArray(entitlements) ? entitlements[0] : entitlements;
    if (entitlement?.premium_architect !== true) return NextResponse.json({ error: "AI Site Architect est disponible avec l’offre Pro." }, { status: 403 });
  }

  let allowance: string;
  try {
    allowance = await consumeAiAllowance(auth.supabase, siteId);
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

  if (field === "siteArchitect" || field === "siteRevision") {
    try {
      const proposal = await generatePremiumSiteArchitect({
        apiKey,
        mode: field === "siteRevision" ? "revision" : "create",
        language: language as "French" | "English",
        affiliationRules: complianceRules,
        instruction,
        firstName,
        brandName,
        architectBrief,
        revisionRequest,
        existingProposal,
        editorialContext,
        currentText,
        contentLibrary: Array.isArray(context.contentLibrary) ? context.contentLibrary : []
      });
      return NextResponse.json({ proposal, premium: true });
    } catch (error) {
      console.error("Premium Site Architect failed", error);
      if (error instanceof PremiumArchitectError) {
        const unavailable =
          error.code === "credit_balance_exhausted" ||
          error.code === "insufficient_quota";
        return NextResponse.json(
          {
            error: unavailable
              ? "L'Architecte Premium est momentanément indisponible. Votre demande n'a pas été générée."
              : error.status === 429
                ? "L'Architecte Premium reçoit trop de demandes. Réessayez dans quelques instants."
                : "L'Architecte Premium n'a pas pu finaliser la proposition. Réessayez dans quelques instants."
          },
          { status: unavailable ? 503 : 502 }
        );
      }
      return NextResponse.json(
        { error: "L'Architecte Premium n'a pas pu finaliser la proposition. Réessayez." },
        { status: 502 }
      );
    }
  }

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
    field === "siteArchitect" || field === "siteRevision"
      ? `Return ONLY valid JSON with this exact shape: {\"heroTagline\":\"\",\"heroTitle\":\"\",\"heroSubtitle\":\"\",\"aboutHeading\":\"\",\"aboutText\":\"\",\"bookingLabel\":\"\",\"recommendedModules\":[\"faq\",\"benefits\",\"contact\"],\"faq\":{\"title\":\"\",\"items\":[{\"question\":\"\",\"answer\":\"\"}]},\"benefits\":{\"title\":\"\",\"items\":[{\"title\":\"\",\"text\":\"\"}]},\"architecture\":{\"mode\":\"single\",\"pages\":[{\"id\":\"home\",\"slug\":\"\",\"title\":\"Accueil\",\"kind\":\"home\",\"purpose\":\"\",\"assetIds\":[]}]},\"design\":{\"layout\":\"classic\",\"heroLayout\":\"split\",\"contentWidth\":\"balanced\",\"accent\":\"#57d4c9\",\"background\":\"ivory\",\"pattern\":\"none\",\"patternStrength\":\"soft\"}}. Choose the information architecture first. architecture.mode must be single or multi. Propose 1 to 6 pages only when separate pages genuinely improve the visitor journey. Every page must have id, slug, title, kind, purpose and assetIds. assetIds may contain only IDs from user content that is explicitly publishable and has known rights. Assign assets only where they materially improve that page; never fabricate an asset ID. kind must be home, about, services, gallery, faq, contact or custom. There must be exactly one home page with an empty slug. Do not create pages just to make the site look larger. Do not invent content for pages that require missing evidence; the purpose may state what user-provided content is still needed. Choose the site composition too: layout must be classic, editorial, showcase or conversion; heroLayout must be split, centered or immersive; contentWidth must be compact, balanced or wide. Use editorial for story-led content, showcase for visual portfolios, conversion for focused lead generation, and classic for balanced general-purpose sites. Then choose design only from these safe values: accent must be one of #57d4c9, #e9ae65, #90b8ef, #d99bb2, #b8cb83, #264653, #2a9d8f, #e76f51, #6b705c, #111827; background must be ivory, sand, mist, sage or slate; pattern must be none, dots, lines, grid or rays; patternStrength must be soft or bold. Choose a restrained combination matching the requested tone. Use only recommendedModules from gallery, faq, testimonials, contact, video, figures, benefits. Recommend only modules justified by supplied information. Never fabricate testimonials, gallery images, videos, contact details, numbers, prices, savings, credentials or claims. FAQ answers and benefits must be supported by the brief. bookingLabel is only a label, never invent a booking URL. Write a polished first version, not hype. The user must review before applying.`
      : field === "qualityReview"
      ? "Return ONLY valid JSON: {\"issues\":[{\"field\":\"heroTitle\",\"reason\":\"brief actionable reason\"}],\"suggestions\":{\"heroTitle\":\"corrected full field text\"}}. Allowed field keys: heroTagline, heroTitle, heroSubtitle, aboutHeading, aboutText, bookingLabel. Check spelling, grammar, coherence between fields, redundant ideas, clarity of the visitor benefit, credibility of marketing language and the CTA. Prefer concrete natural wording over hype or generic claims. Include a suggestion only for an actual error or worthwhile editorial improvement. Maximum six issues. Preserve facts and never invent claims. If all is good, return empty arrays and object."
      : field === "guidedDraft"
      ? "Return ONLY valid JSON with keys heroTagline, heroTitle, heroSubtitle, aboutHeading, aboutText. Treat the guided answers as notes, not copy to paste. Turn even one or two keywords into fluent complete sentences, but never invent facts. Give each field a distinct role: heroTagline = very short mood/angle; heroTitle = clear memorable promise or point of view; heroSubtitle = 2 or 3 sentences explaining what the visitor will discover; aboutHeading = personal section title; aboutText = 70 to 130 words connecting the person's travel profile, discovery and motivation naturally. Use the audience answer only if it was supplied. Avoid repeating the same phrase, benefit or opening across fields. Every prose sentence must begin with a capital letter and be grammatically complete. Use a polished, natural, moderately formal register by default; the user can simplify it later."
      : field === "moduleDraft"
        ? modulePrompt
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
      max_output_tokens: field === "siteArchitect" ? 1100 : field === "guidedDraft" ? 650 : field === "qualityReview" ? 800 : field === "moduleDraft" ? 900 : field === "aboutText" ? 320 : 140
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

  if (field === "siteArchitect" || field === "siteRevision") {
    try {
      const cleaned = text.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
      const raw = JSON.parse(cleaned);
      const allowedModules = ["gallery", "faq", "testimonials", "contact", "video", "figures", "benefits"];
      const proposal = {
        heroTagline: clean(raw.heroTagline, 90),
        heroTitle: clean(raw.heroTitle, 90),
        heroSubtitle: clean(raw.heroSubtitle, 420),
        aboutHeading: clean(raw.aboutHeading, 100),
        aboutText: clean(raw.aboutText, 1800),
        bookingLabel: clean(raw.bookingLabel, 45),
        architecture: (() => {
          const allowedKinds = ["home","about","services","gallery","faq","contact","custom"];
          const source = Array.isArray(raw.architecture?.pages) ? raw.architecture.pages.slice(0, 6) : [];
          const clearedAssetIds = new Set((Array.isArray(context.contentLibrary) ? context.contentLibrary : []).filter((asset: any) => asset?.publishable && asset?.rights && asset.rights !== "unknown").map((asset: any) => clean(asset?.id, 80)).filter(Boolean));
          const usedIds = new Set<string>();
          const usedSlugs = new Set<string>();
          let homeSeen = false;
          const pages = source.map((page: any, index: number) => {
            let kind = allowedKinds.includes(page?.kind) ? page.kind : "custom";
            if (kind === "home") { if (homeSeen) kind = "custom"; else homeSeen = true; }
            let id = clean(page?.id, 60) || `page-${index + 1}`;
            const idBase = id; let idSuffix = 2; while (usedIds.has(id)) id = `${idBase}-${idSuffix++}`.slice(0, 60); usedIds.add(id);
            let slug = kind === "home" ? "" : clean(page?.slug, 60).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `page-${index + 1}`;
            if (kind !== "home") { const slugBase = slug; let slugSuffix = 2; while (usedSlugs.has(slug)) slug = `${slugBase}-${slugSuffix++}`.slice(0, 60); usedSlugs.add(slug); }
            const assetIds = [...new Set((Array.isArray(page?.assetIds) ? page.assetIds : []).map((id: unknown) => clean(id, 80)).filter((id: string) => clearedAssetIds.has(id)))].slice(0, 12);
            return { id, slug, title: clean(page?.title, 80) || "Page", kind, purpose: clean(page?.purpose, 240), enabled: kind === "home" ? true : page?.enabled !== false, assetIds };
          });
          if (!homeSeen) pages.unshift({ id: "home", slug: "", title: "Accueil", kind: "home", purpose: "Présenter l’activité et orienter le visiteur.", enabled: true, assetIds: [] });
          return { mode: raw.architecture?.mode === "multi" && pages.filter((page: any) => page.enabled).length > 1 ? "multi" : "single", pages };
        })(),
        design: {
          layout: ["classic","editorial","showcase","conversion"].includes(raw.design?.layout) ? raw.design.layout : "classic",
          heroLayout: ["split","centered","immersive"].includes(raw.design?.heroLayout) ? raw.design.heroLayout : "split",
          contentWidth: ["compact","balanced","wide"].includes(raw.design?.contentWidth) ? raw.design.contentWidth : "balanced",
          accent: ["#57d4c9","#e9ae65","#90b8ef","#d99bb2","#b8cb83","#264653","#2a9d8f","#e76f51","#6b705c","#111827"].includes(raw.design?.accent) ? raw.design.accent : "#57d4c9",
          background: ["ivory","sand","mist","sage","slate"].includes(raw.design?.background) ? raw.design.background : "ivory",
          pattern: ["none","dots","lines","grid","rays"].includes(raw.design?.pattern) ? raw.design.pattern : "none",
          patternStrength: raw.design?.patternStrength === "bold" ? "bold" : "soft"
        },
        recommendedModules: (Array.isArray(raw.recommendedModules) ? raw.recommendedModules : []).filter((item: unknown) => typeof item === "string" && allowedModules.includes(item)).slice(0, 5),
        faq: {
          title: clean(raw.faq?.title, 100),
          items: (Array.isArray(raw.faq?.items) ? raw.faq.items : []).slice(0, 6).map((item: any) => ({ question: clean(item?.question, 200), answer: clean(item?.answer, 1200) })).filter((item: any) => item.question && item.answer)
        },
        benefits: {
          title: clean(raw.benefits?.title, 100),
          items: (Array.isArray(raw.benefits?.items) ? raw.benefits.items : []).slice(0, 5).map((item: any) => ({ title: clean(item?.title, 100), text: clean(item?.text, 500) })).filter((item: any) => item.title && item.text)
        }
      };
      if (!proposal.heroTitle || !proposal.heroSubtitle || !proposal.aboutText) throw new Error("Incomplete site proposal");
      return NextResponse.json({ proposal });
    } catch (error) {
      console.error("Invalid site architect output", error);
      return NextResponse.json({ error: "L'IA n'a pas pu structurer le site complet. Réessayez." }, { status: 502 });
    }
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

  if (field === "moduleDraft") {
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const raw = JSON.parse(cleaned);
      const title = clean(raw?.title, 100);
      const items = Array.isArray(raw?.items) ? raw.items.slice(0, 6) : [];
      if (!title || !items.length) throw new Error("Incomplete module draft");

      if (moduleType === "faq") {
        const normalized = items
          .map((item: any) => ({ question: clean(item?.question, 200), answer: clean(item?.answer, 1200) }))
          .filter((item: any) => item.question && item.answer);
        if (!normalized.length) throw new Error("Empty FAQ draft");
        return NextResponse.json({ draft: { title, items: normalized } });
      }

      if (moduleType === "benefits") {
        const normalized = items
          .map((item: any) => ({ title: clean(item?.title, 100), text: clean(item?.text, 500) }))
          .filter((item: any) => item.title && item.text);
        if (!normalized.length) throw new Error("Empty benefits draft");
        return NextResponse.json({ draft: { title, items: normalized } });
      }

      const normalized = items
        .map((item: any) => ({ value: "", label: clean(item?.label, 120) }))
        .filter((item: any) => item.label);
      if (!normalized.length) throw new Error("Empty figures draft");
      return NextResponse.json({ draft: { title, items: normalized } });
    } catch (error) {
      console.error("Invalid module draft output", error);
      return NextResponse.json({ error: "L'IA n'a pas pu structurer cette rubrique. Réessayez." }, { status: 502 });
    }
  }

  return NextResponse.json({ text });
}

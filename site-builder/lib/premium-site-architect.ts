type ArchitectMode = "create" | "revision";

export type PremiumArchitectAsset = {
  id?: string;
  kind?: string;
  name?: string;
  text?: string;
  rights?: string;
  publishable?: boolean;
  sourceUrl?: string;
  notes?: string;
};

export type PremiumArchitectUsage = {
  operation:
    | "premium_strategy"
    | "premium_creation"
    | "premium_review"
    | "premium_refinement"
    | "premium_final_review";
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  durationMs: number;
};

export type PremiumArchitectInput = {
  apiKey: string;
  mode: ArchitectMode;
  language: "French" | "English";
  affiliationRules: string;
  instruction: string;
  firstName: string;
  brandName: string;
  architectBrief: string;
  revisionRequest?: string;
  existingProposal?: unknown;
  editorialContext?: string;
  currentText?: string;
  contentLibrary?: PremiumArchitectAsset[];
  onUsage?: (usage: PremiumArchitectUsage) => Promise<void> | void;
};

export type PremiumArchitectProposal = {
  heroTagline: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutHeading: string;
  aboutText: string;
  bookingLabel: string;
  recommendedModules: string[];
  moduleOrder: string[];
  faq: { title: string; items: { question: string; answer: string }[] };
  benefits: { title: string; items: { title: string; text: string }[] };
  architecture: {
    mode: "single" | "multi";
    pages: {
      id: string;
      slug: string;
      title: string;
      kind: "home" | "about" | "services" | "gallery" | "faq" | "contact" | "custom";
      purpose: string;
      headline: string;
      intro: string;
      sections: { heading: string; text: string }[];
      enabled: boolean;
      assetIds: string[];
    }[];
  };
  design: {
    layout: "classic" | "editorial" | "showcase" | "conversion";
    heroLayout: "split" | "centered" | "immersive";
    contentWidth: "compact" | "balanced" | "wide";
    accent: string;
    background: "ivory" | "sand" | "mist" | "sage" | "slate";
    pattern: "none" | "dots" | "lines" | "grid" | "rays";
    patternStrength: "soft" | "bold";
  };
  intelligence: {
    readiness: "strong" | "usable" | "thin";
    understoodNeed: string;
    audience: string;
    primaryGoal: string;
    secondaryGoals: string[];
    positioning: string;
    toneKeywords: string[];
    visitorJourney: string[];
    contentPriorities: string[];
    conversionStrategy: string;
    architectureRationale: string;
    designRationale: string;
    missingInformation: string[];
    assumptions: string[];
  };
  premiumAudit: {
    reviewed: true;
    refinementApplied: boolean;
    finalReviewPerformed: boolean;
    finalVerified: boolean;
    initialScore: number;
    finalScore: number;
    issuesDetected: number;
    majorIssuesDetected: number;
    finalIssuesDetected: number;
    finalMajorIssuesDetected: number;
    strengths: string[];
    qualityNote: string;
  };
};

export class PremiumArchitectError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = "premium_architect_failed") {
    super(message);
    this.name = "PremiumArchitectError";
    this.status = status;
    this.code = code;
  }
}

const strategySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    readiness: { type: "string", enum: ["strong", "usable", "thin"] },
    understoodNeed: { type: "string" },
    audience: { type: "string" },
    primaryGoal: { type: "string" },
    secondaryGoals: { type: "array", items: { type: "string" } },
    positioning: { type: "string" },
    toneKeywords: { type: "array", items: { type: "string" } },
    visitorJourney: { type: "array", items: { type: "string" } },
    contentPriorities: { type: "array", items: { type: "string" } },
    conversionStrategy: { type: "string" },
    architectureRationale: { type: "string" },
    designRationale: { type: "string" },
    missingInformation: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } }
  },
  required: [
    "readiness",
    "understoodNeed",
    "audience",
    "primaryGoal",
    "secondaryGoals",
    "positioning",
    "toneKeywords",
    "visitorJourney",
    "contentPriorities",
    "conversionStrategy",
    "architectureRationale",
    "designRationale",
    "missingInformation",
    "assumptions"
  ]
} as const;

const pageSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    title: { type: "string" },
    kind: { type: "string", enum: ["home", "about", "services", "gallery", "faq", "contact", "custom"] },
    purpose: { type: "string" },
    headline: { type: "string" },
    intro: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          text: { type: "string" }
        },
        required: ["heading", "text"]
      }
    },
    enabled: { type: "boolean" },
    assetIds: { type: "array", items: { type: "string" } }
  },
  required: ["id", "slug", "title", "kind", "purpose", "headline", "intro", "sections", "enabled", "assetIds"]
} as const;

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    heroTagline: { type: "string" },
    heroTitle: { type: "string" },
    heroSubtitle: { type: "string" },
    aboutHeading: { type: "string" },
    aboutText: { type: "string" },
    bookingLabel: { type: "string" },
    recommendedModules: {
      type: "array",
      items: { type: "string", enum: ["gallery", "faq", "testimonials", "contact", "video", "figures", "benefits"] }
    },
    moduleOrder: {
      type: "array",
      items: { type: "string", enum: ["gallery", "faq", "testimonials", "contact", "video", "figures", "benefits"] }
    },
    faq: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              question: { type: "string" },
              answer: { type: "string" }
            },
            required: ["question", "answer"]
          }
        }
      },
      required: ["title", "items"]
    },
    benefits: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              text: { type: "string" }
            },
            required: ["title", "text"]
          }
        }
      },
      required: ["title", "items"]
    },
    architecture: {
      type: "object",
      additionalProperties: false,
      properties: {
        mode: { type: "string", enum: ["single", "multi"] },
        pages: { type: "array", items: pageSchema }
      },
      required: ["mode", "pages"]
    },
    design: {
      type: "object",
      additionalProperties: false,
      properties: {
        layout: { type: "string", enum: ["classic", "editorial", "showcase", "conversion"] },
        heroLayout: { type: "string", enum: ["split", "centered", "immersive"] },
        contentWidth: { type: "string", enum: ["compact", "balanced", "wide"] },
        accent: {
          type: "string",
          enum: ["#57d4c9", "#e9ae65", "#90b8ef", "#d99bb2", "#b8cb83", "#264653", "#2a9d8f", "#e76f51", "#6b705c", "#111827"]
        },
        background: { type: "string", enum: ["ivory", "sand", "mist", "sage", "slate"] },
        pattern: { type: "string", enum: ["none", "dots", "lines", "grid", "rays"] },
        patternStrength: { type: "string", enum: ["soft", "bold"] }
      },
      required: ["layout", "heroLayout", "contentWidth", "accent", "background", "pattern", "patternStrength"]
    }
  },
  required: [
    "heroTagline",
    "heroTitle",
    "heroSubtitle",
    "aboutHeading",
    "aboutText",
    "bookingLabel",
    "recommendedModules",
    "moduleOrder",
    "faq",
    "benefits",
    "architecture",
    "design"
  ]
} as const;

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["pass", "refine"] },
    overallScore: { type: "integer" },
    strengths: { type: "array", items: { type: "string" } },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", enum: ["minor", "major"] },
          area: { type: "string", enum: ["strategy", "copy", "structure", "conversion", "credibility", "design", "compliance"] },
          problem: { type: "string" },
          fix: { type: "string" }
        },
        required: ["severity", "area", "problem", "fix"]
      }
    }
  },
  required: ["verdict", "overallScore", "strengths", "issues"]
} as const;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function extractText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }
  return "";
}

async function structuredResponse(args: {
  apiKey: string;
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string;
  maxOutputTokens: number;
  effort: "low" | "medium";
  operation: PremiumArchitectUsage["operation"];
  onUsage?: PremiumArchitectInput["onUsage"];
}) {
  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: args.model,
      instructions: args.instructions,
      input: args.input,
      reasoning: { effort: args.effort },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: args.schemaName,
          strict: true,
          schema: args.schema
        }
      },
      max_output_tokens: args.maxOutputTokens
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data?.error?.code || "unknown";
    throw new PremiumArchitectError(
      data?.error?.message || "OpenAI architect request failed",
      response.status,
      code
    );
  }

  if (args.onUsage) {
    const usage = data?.usage || {};
    try {
      await args.onUsage({
        operation: args.operation,
        model: clean(data?.model, 100) || args.model,
        inputTokens: Math.max(0, Number(usage?.input_tokens) || 0),
        cachedInputTokens: Math.max(
          0,
          Number(usage?.input_tokens_details?.cached_tokens) || 0
        ),
        outputTokens: Math.max(0, Number(usage?.output_tokens) || 0),
        reasoningTokens: Math.max(
          0,
          Number(usage?.output_tokens_details?.reasoning_tokens) || 0
        ),
        totalTokens: Math.max(0, Number(usage?.total_tokens) || 0),
        durationMs: Math.max(0, Date.now() - startedAt)
      });
    } catch (error) {
      console.warn("Premium Architect usage telemetry unavailable", error);
    }
  }

  const text = extractText(data);
  if (!text) {
    throw new PremiumArchitectError("OpenAI architect returned no structured output", 502, "empty_output");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new PremiumArchitectError("OpenAI architect returned invalid structured output", 502, "invalid_json");
  }
}

function safeAssets(assets: PremiumArchitectAsset[] = []) {
  return assets.slice(0, 20).map((asset) => ({
    id: clean(asset.id, 80),
    kind: clean(asset.kind, 30),
    name: clean(asset.name, 160),
    text: clean(asset.text, 1600),
    rights: clean(asset.rights, 40),
    publishable: asset.publishable === true,
    sourceUrl: clean(asset.sourceUrl, 600),
    notes: clean(asset.notes, 500)
  }));
}

type PremiumArchitectCore = Omit<PremiumArchitectProposal, "intelligence" | "premiumAudit">;

function normalizeProposal(raw: any, assets: PremiumArchitectAsset[]): PremiumArchitectCore {
  const allowedModules = ["gallery", "faq", "testimonials", "contact", "video", "figures", "benefits"];
  const allowedKinds = ["home", "about", "services", "gallery", "faq", "contact", "custom"];
  const clearedAssetIds = new Set(
    assets
      .filter((asset) => asset?.publishable && asset?.rights && asset.rights !== "unknown")
      .map((asset) => clean(asset.id, 80))
      .filter(Boolean)
  );

  const usedIds = new Set<string>();
  const usedSlugs = new Set<string>();
  let homeSeen = false;

  const pages = (Array.isArray(raw?.architecture?.pages) ? raw.architecture.pages : [])
    .slice(0, 6)
    .map((page: any, index: number) => {
      let kind = allowedKinds.includes(page?.kind) ? page.kind : "custom";
      if (kind === "home") {
        if (homeSeen) kind = "custom";
        else homeSeen = true;
      }

      let id = clean(page?.id, 60) || `page-${index + 1}`;
      const idBase = id;
      let idSuffix = 2;
      while (usedIds.has(id)) id = `${idBase}-${idSuffix++}`.slice(0, 60);
      usedIds.add(id);

      let slug =
        kind === "home"
          ? ""
          : clean(page?.slug, 60)
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "") || `page-${index + 1}`;

      if (kind !== "home") {
        const slugBase = slug;
        let slugSuffix = 2;
        while (usedSlugs.has(slug)) slug = `${slugBase}-${slugSuffix++}`.slice(0, 60);
        usedSlugs.add(slug);
      }

      const assetIds = [
        ...new Set(
          (Array.isArray(page?.assetIds) ? page.assetIds : [])
            .map((item: unknown) => clean(item, 80))
            .filter((item: string) => clearedAssetIds.has(item))
        )
      ].slice(0, 12);

      const sections =
        kind === "home"
          ? []
          : (Array.isArray(page?.sections) ? page.sections : [])
              .slice(0, 4)
              .map((section: any) => ({
                heading: clean(section?.heading, 120),
                text: clean(section?.text, 1800)
              }))
              .filter((section: { heading: string; text: string }) =>
                Boolean(section.heading || section.text)
              );

      return {
        id,
        slug,
        title: clean(page?.title, 80) || (kind === "home" ? "Accueil" : "Page"),
        kind,
        purpose: clean(page?.purpose, 280),
        headline: kind === "home" ? "" : clean(page?.headline, 120),
        intro: kind === "home" ? "" : clean(page?.intro, 600),
        sections,
        enabled: kind === "home" ? true : page?.enabled !== false,
        assetIds
      };
    });

  if (!homeSeen) {
    pages.unshift({
      id: "home",
      slug: "",
      title: "Accueil",
      kind: "home",
      purpose: "Présenter clairement l’activité et orienter le visiteur vers la prochaine action utile.",
      headline: "",
      intro: "",
      sections: [],
      enabled: true,
      assetIds: []
    });
  }

  const recommendedModules = Array.from(
    new Set<string>(
      (Array.isArray(raw?.recommendedModules) ? raw.recommendedModules : []).filter(
        (item: unknown): item is string => typeof item === "string" && allowedModules.includes(item)
      )
    )
  ).slice(0, 7);

  const requestedOrder = Array.from(
    new Set<string>(
      (Array.isArray(raw?.moduleOrder) ? raw.moduleOrder : []).filter(
        (item: unknown): item is string => typeof item === "string" && allowedModules.includes(item)
      )
    )
  );
  const moduleOrder = [
    ...requestedOrder,
    ...allowedModules.filter((item) => !requestedOrder.includes(item))
  ];

  const proposal = {
    heroTagline: clean(raw?.heroTagline, 90),
    heroTitle: clean(raw?.heroTitle, 90),
    heroSubtitle: clean(raw?.heroSubtitle, 420),
    aboutHeading: clean(raw?.aboutHeading, 100),
    aboutText: clean(raw?.aboutText, 1800),
    bookingLabel: clean(raw?.bookingLabel, 45),
    recommendedModules,
    moduleOrder,
    faq: {
      title: clean(raw?.faq?.title, 100),
      items: (Array.isArray(raw?.faq?.items) ? raw.faq.items : [])
        .slice(0, 6)
        .map((item: any) => ({
          question: clean(item?.question, 200),
          answer: clean(item?.answer, 1200)
        }))
        .filter((item: any) => item.question && item.answer)
    },
    benefits: {
      title: clean(raw?.benefits?.title, 100),
      items: (Array.isArray(raw?.benefits?.items) ? raw.benefits.items : [])
        .slice(0, 5)
        .map((item: any) => ({
          title: clean(item?.title, 100),
          text: clean(item?.text, 500)
        }))
        .filter((item: any) => item.title && item.text)
    },
    architecture: {
      mode:
        raw?.architecture?.mode === "multi" &&
        pages.filter((page: any) => page.enabled).length > 1
          ? "multi"
          : "single",
      pages
    },
    design: {
      layout: ["classic", "editorial", "showcase", "conversion"].includes(raw?.design?.layout)
        ? raw.design.layout
        : "classic",
      heroLayout: ["split", "centered", "immersive"].includes(raw?.design?.heroLayout)
        ? raw.design.heroLayout
        : "split",
      contentWidth: ["compact", "balanced", "wide"].includes(raw?.design?.contentWidth)
        ? raw.design.contentWidth
        : "balanced",
      accent: ["#57d4c9", "#e9ae65", "#90b8ef", "#d99bb2", "#b8cb83", "#264653", "#2a9d8f", "#e76f51", "#6b705c", "#111827"].includes(raw?.design?.accent)
        ? raw.design.accent
        : "#57d4c9",
      background: ["ivory", "sand", "mist", "sage", "slate"].includes(raw?.design?.background)
        ? raw.design.background
        : "ivory",
      pattern: ["none", "dots", "lines", "grid", "rays"].includes(raw?.design?.pattern)
        ? raw.design.pattern
        : "none",
      patternStrength: raw?.design?.patternStrength === "bold" ? "bold" : "soft"
    }
  };

  if (!proposal.heroTitle || !proposal.heroSubtitle || !proposal.aboutText) {
    throw new PremiumArchitectError("Incomplete premium architect proposal", 502, "incomplete_proposal");
  }

  return proposal as PremiumArchitectCore;
}

function compactStrategy(raw: any): PremiumArchitectProposal["intelligence"] {
  return {
    readiness: (["strong", "usable", "thin"].includes(raw?.readiness) ? raw.readiness : "usable") as "strong" | "usable" | "thin",
    understoodNeed: clean(raw?.understoodNeed, 500),
    audience: clean(raw?.audience, 320),
    primaryGoal: clean(raw?.primaryGoal, 280),
    secondaryGoals: (Array.isArray(raw?.secondaryGoals) ? raw.secondaryGoals : []).slice(0, 4).map((item: unknown) => clean(item, 220)).filter(Boolean),
    positioning: clean(raw?.positioning, 420),
    toneKeywords: (Array.isArray(raw?.toneKeywords) ? raw.toneKeywords : []).slice(0, 6).map((item: unknown) => clean(item, 80)).filter(Boolean),
    visitorJourney: (Array.isArray(raw?.visitorJourney) ? raw.visitorJourney : []).slice(0, 6).map((item: unknown) => clean(item, 220)).filter(Boolean),
    contentPriorities: (Array.isArray(raw?.contentPriorities) ? raw.contentPriorities : []).slice(0, 6).map((item: unknown) => clean(item, 220)).filter(Boolean),
    conversionStrategy: clean(raw?.conversionStrategy, 380),
    architectureRationale: clean(raw?.architectureRationale, 500),
    designRationale: clean(raw?.designRationale, 500),
    missingInformation: (Array.isArray(raw?.missingInformation) ? raw.missingInformation : []).slice(0, 6).map((item: unknown) => clean(item, 220)).filter(Boolean),
    assumptions: (Array.isArray(raw?.assumptions) ? raw.assumptions : []).slice(0, 6).map((item: unknown) => clean(item, 220)).filter(Boolean)
  };
}

function clampScore(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export async function generatePremiumSiteArchitect(
  input: PremiumArchitectInput
): Promise<PremiumArchitectProposal> {
  const premiumModel = process.env.OPENAI_ARCHITECT_MODEL || "gpt-5.6";
  const auxiliaryModel = process.env.OPENAI_ARCHITECT_AUX_MODEL || "gpt-5.6-terra";
  const assets = safeAssets(input.contentLibrary || []);

  const sourceContext = {
    mode: input.mode,
    language: input.language,
    firstName: input.firstName,
    brandName: input.brandName,
    brief: input.architectBrief,
    revisionRequest: input.revisionRequest || "",
    instruction: input.instruction,
    editorialContext: input.editorialContext || "",
    currentText: input.currentText || "",
    existingProposal: input.mode === "revision" ? input.existingProposal || null : null,
    contentLibrary: assets
  };

  const strategy = compactStrategy(
    await structuredResponse({
      apiKey: input.apiKey,
      model: auxiliaryModel,
      schemaName: "ajg_site_strategy",
      schema: strategySchema as unknown as Record<string, unknown>,
      maxOutputTokens: 1300,
      effort: "medium",
      operation: "premium_strategy",
      onUsage: input.onUsage,
      instructions: [
        "You are the strategy layer of AJG Premium Site Architect.",
        "Act as a senior website strategist combining UX, information architecture, conversion design and editorial positioning.",
        "Diagnose the visitor need before any copy is written.",
        "Use only supplied facts. Never create evidence, credentials, numbers, offers, prices, testimonials or product capabilities.",
        "When information is missing, identify it explicitly instead of guessing. Every missingInformation item must be a short, concrete question addressed directly to the user in the requested site language. Ask only questions whose answer could materially improve the website. Conservative assumptions are allowed only when they concern presentation or structure, never factual claims.",
        "Recommend the smallest useful site architecture, not the largest.",
        "The result must be practical enough for a second model to create the website.",
        input.affiliationRules
      ].join(" "),
      input: JSON.stringify(sourceContext)
    })
  );

  const creationInput = {
    sourceContext,
    strategy
  };

  const creation = normalizeProposal(
    await structuredResponse({
      apiKey: input.apiKey,
      model: premiumModel,
      schemaName: "ajg_premium_site_proposal",
      schema: proposalSchema as unknown as Record<string, unknown>,
      maxOutputTokens: 3000,
      effort: "medium",
      operation: "premium_creation",
      onUsage: input.onUsage,
      instructions: [
        "You are AJG Premium Site Architect, an expert website creator for non-expert customers.",
        "Build a polished, credible website proposal from the approved strategy.",
        "Treat strategy as the design brief, not text to copy mechanically.",
        "Optimize the visitor journey in this order: immediate comprehension, credibility, relevance, useful detail, then one clear next action.",
        "Each field must have a distinct role and avoid repeated wording.",
        "Prefer concrete, human writing over generic marketing language, clichés and exaggerated claims.",
        "Never invent facts, testimonials, figures, prices, savings, certifications, customer results, contact details or capabilities.",
        "If a useful fact is missing, write safely around it and leave the missing-information signal in the strategy rather than fabricating it.",
        "Architecture must stay between one and six pages and include exactly one home page.",
        "The home page uses the top-level hero/about fields, so keep its page-level headline, intro and sections empty.",
        "For every enabled non-home page, write page-specific copy when the supplied facts justify it: a distinct headline, a concise intro, and zero to four useful sections. Each section must add information or explanation rather than restate the hero or another section.",
        "About pages may deepen the person's story only from supplied facts. Services pages may explain an offer only from supplied facts. Gallery, FAQ and contact pages should use minimal supporting copy because their module carries the main content. Custom pages should receive the strongest useful page-specific content supported by the brief.",
        "Do not create filler sections merely to make a page longer. If the evidence is too thin, keep sections empty and preserve the missing-information signal instead of fabricating material.",
        "Only assign asset IDs that exist in the supplied rights-cleared content library.",
        "FAQ and benefits may contain only claims supported by the source context.",
        "Do not create testimonial copy, numeric figures, video URLs or contact details.",
        "Use the visual system as an intentional composition decision, not decoration.",
        "Output impeccable French or English according to the requested language.",
        input.affiliationRules
      ].join(" "),
      input: JSON.stringify(creationInput)
    }),
    assets
  );

  const review = await structuredResponse({
    apiKey: input.apiKey,
    model: auxiliaryModel,
    schemaName: "ajg_premium_site_review",
    schema: reviewSchema as unknown as Record<string, unknown>,
    maxOutputTokens: 1200,
    effort: "low",
    operation: "premium_review",
    onUsage: input.onUsage,
    instructions: [
      "You are the independent QA critic for AJG Premium Site Architect.",
      "Audit the proposal against the source context and strategy.",
      "Be demanding. Check strategic fit, clarity, editorial quality, information architecture, page-specific copy, conversion logic, credibility, design coherence and compliance.",
      "For multi-page proposals, verify that each enabled secondary page earns its place and has distinct useful copy where the source facts support it; flag repeated hero copy, filler sections and pages that should be merged.",
      "A score above 90 requires a genuinely strong, differentiated and coherent proposal with no unsupported factual claim.",
      "Mark refine when there is any major issue, unsupported claim, generic copy, weak visitor journey, unnecessary page, contradictory module choice or obvious design mismatch.",
      "Do not request invented information. Missing factual information should remain explicitly missing.",
      input.affiliationRules
    ].join(" "),
    input: JSON.stringify({ sourceContext, strategy, proposal: creation })
  });

  const issues = Array.isArray(review?.issues) ? review.issues.slice(0, 8) : [];
  const majorIssues = issues.filter((item: any) => item?.severity === "major");
  const score = clampScore(review?.overallScore);
  const shouldRefine =
    review?.verdict === "refine" ||
    majorIssues.length > 0 ||
    score < 90;

  let finalProposal = creation;
  if (shouldRefine) {
    finalProposal = normalizeProposal(
      await structuredResponse({
        apiKey: input.apiKey,
        model: premiumModel,
        schemaName: "ajg_premium_site_refinement",
        schema: proposalSchema as unknown as Record<string, unknown>,
        maxOutputTokens: 3000,
        effort: "medium",
        operation: "premium_refinement",
        onUsage: input.onUsage,
        instructions: [
          "You are the final refinement layer of AJG Premium Site Architect.",
          "Return a complete corrected proposal, not a commentary.",
          "Resolve every review issue that can be fixed without inventing facts.",
          "Preserve strong parts of the proposal and preserve the strategy.",
          "Do not add unsupported claims to make the site sound stronger.",
          "Prefer deleting weak or unjustified material over filling gaps with generic copy.",
          "Keep the same strict safety, compliance, rights and factual-grounding rules.",
          input.affiliationRules
        ].join(" "),
        input: JSON.stringify({
          sourceContext,
          strategy,
          proposal: creation,
          review: {
            score,
            issues
          }
        })
      }),
      assets
    );
  }

  let finalReview = review;
  if (shouldRefine) {
    finalReview = await structuredResponse({
      apiKey: input.apiKey,
      model: auxiliaryModel,
      schemaName: "ajg_premium_site_final_review",
      schema: reviewSchema as unknown as Record<string, unknown>,
      maxOutputTokens: 1000,
      effort: "low",
      operation: "premium_final_review",
      onUsage: input.onUsage,
      instructions: [
        "You are the final independent quality gate for AJG Premium Site Architect.",
        "Review only the refined proposal that will actually be shown to the customer.",
        "Verify that the previous review problems are resolved without introducing unsupported facts.",
        "Check factual grounding, compliance, strategic fit, clarity, differentiation, visitor journey, conversion logic, information architecture, page-specific copy and design coherence.",
        "For multi-page sites, confirm that secondary-page headlines, intros and sections are useful, non-repetitive and fully supported by the source context.",
        "Do not penalize facts that are explicitly marked as missing instead of invented.",
        "Use major severity only for unsupported factual claims, compliance problems, contradictions, broken information architecture or another issue serious enough that the proposal should not be presented as finished.",
        "A pass requires no major issue and a genuinely polished proposal. Do not create new requirements unrelated to the supplied brief.",
        input.affiliationRules
      ].join(" "),
      input: JSON.stringify({
        sourceContext,
        strategy,
        previousReview: {
          score,
          issues
        },
        refinedProposal: finalProposal
      })
    });
  }

  const finalIssues = Array.isArray(finalReview?.issues)
    ? finalReview.issues.slice(0, 8)
    : [];
  const finalMajorIssues = finalIssues.filter(
    (item: any) => item?.severity === "major"
  );
  const finalScore = clampScore(finalReview?.overallScore);
  const finalVerified =
    finalReview?.verdict === "pass" &&
    finalMajorIssues.length === 0 &&
    finalScore >= 88;

  if (!finalVerified) {
    throw new PremiumArchitectError(
      "Premium Architect final quality gate did not pass",
      502,
      "quality_gate_failed"
    );
  }

  const strengths = (
    Array.isArray(finalReview?.strengths) ? finalReview.strengths : []
  )
    .slice(0, 4)
    .map((item: unknown) => clean(item, 220))
    .filter(Boolean);

  return {
    ...finalProposal,
    intelligence: strategy,
    premiumAudit: {
      reviewed: true,
      refinementApplied: shouldRefine,
      finalReviewPerformed: shouldRefine,
      finalVerified,
      initialScore: score,
      finalScore,
      issuesDetected: issues.length,
      majorIssuesDetected: majorIssues.length,
      finalIssuesDetected: finalIssues.length,
      finalMajorIssuesDetected: finalMajorIssues.length,
      strengths,
      qualityNote: shouldRefine
        ? `Audit premium effectué : ${issues.length} point(s) détecté(s), proposition raffinée, puis contrôle final indépendant validé avant affichage.`
        : "Audit premium effectué : la proposition a passé le contrôle qualité sans raffinement supplémentaire."
    }
  };
}

export type StandardAiField =
  | "heroTagline"
  | "heroTitle"
  | "heroSubtitle"
  | "aboutHeading"
  | "aboutText"
  | "bookingLabel"
  | "guidedDraft"
  | "qualityReview"
  | "moduleDraft";

const editableFields = [
  "heroTagline",
  "heroTitle",
  "heroSubtitle",
  "aboutHeading",
  "aboutText",
  "bookingLabel"
] as const;

type EditableField = (typeof editableFields)[number];

export type StandardContextEntry = readonly [string, string];

export function selectStandardContextEntries(
  field: StandardAiField,
  entries: StandardContextEntry[]
): StandardContextEntry[] {
  const byKey = new Map(entries);
  const pick = (keys: string[], max: number) =>
    keys
      .map((key) => {
        const value = byKey.get(key);
        return value ? ([key, value] as const) : null;
      })
      .filter((item): item is StandardContextEntry => Boolean(item))
      .slice(0, max);

  if (field === "siteArchitect" || field === "siteRevision") {
    return entries.slice(0, 12);
  }

  if (field === "guidedDraft") {
    return pick(
      [
        "activity or offer",
        "differentiation or approach",
        "visitor goal",
        "audience"
      ],
      4
    );
  }

  if (field === "moduleDraft") {
    return pick(
      [
        "module brief",
        "activity or offer",
        "differentiation or approach",
        "visitor goal",
        "audience",
        "headline",
        "intro",
        "about",
        "booking button"
      ],
      9
    );
  }

  if (field === "qualityReview") {
    return pick(
      [
        "headline",
        "intro",
        "tagline",
        "about heading",
        "about",
        "booking button",
        "activity or offer",
        "differentiation or approach",
        "visitor goal",
        "audience"
      ],
      10
    );
  }

  const commonDiscovery = [
    "activity or offer",
    "differentiation or approach",
    "visitor goal",
    "audience"
  ];

  if (field === "bookingLabel") {
    return pick(
      [
        "visitor goal",
        "activity or offer",
        "audience",
        "differentiation or approach",
        "headline",
        "intro",
        "about"
      ],
      7
    );
  }

  if (field === "aboutHeading" || field === "aboutText") {
    return pick(
      [
        ...commonDiscovery,
        "headline",
        "intro",
        "about heading",
        "about"
      ],
      7
    );
  }

  return pick(
    [
      ...commonDiscovery,
      "headline",
      "intro",
      "tagline",
      "about"
    ],
    7
  );
}

const fieldLimits: Record<EditableField, number> = {
  heroTagline: 90,
  heroTitle: 90,
  heroSubtitle: 420,
  aboutHeading: 100,
  aboutText: 1800,
  bookingLabel: 45
};

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function textSchema() {
  return { type: "string" } as const;
}

function objectSchema(
  properties: Record<string, unknown>,
  required: string[]
) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  } as const;
}

const guidedDraftSchema = objectSchema(
  {
    heroTagline: textSchema(),
    heroTitle: textSchema(),
    heroSubtitle: textSchema(),
    aboutHeading: textSchema(),
    aboutText: textSchema()
  },
  ["heroTagline", "heroTitle", "heroSubtitle", "aboutHeading", "aboutText"]
);

const reviewItemSchema = objectSchema(
  {
    field: { type: "string", enum: editableFields },
    reason: textSchema()
  },
  ["field", "reason"]
);

const suggestionItemSchema = objectSchema(
  {
    field: { type: "string", enum: editableFields },
    text: textSchema()
  },
  ["field", "text"]
);

const qualityReviewSchema = objectSchema(
  {
    issues: { type: "array", items: reviewItemSchema },
    suggestions: { type: "array", items: suggestionItemSchema }
  },
  ["issues", "suggestions"]
);

const faqSchema = objectSchema(
  {
    title: textSchema(),
    items: {
      type: "array",
      items: objectSchema(
        { question: textSchema(), answer: textSchema() },
        ["question", "answer"]
      )
    }
  },
  ["title", "items"]
);

const benefitsSchema = objectSchema(
  {
    title: textSchema(),
    items: {
      type: "array",
      items: objectSchema(
        { title: textSchema(), text: textSchema() },
        ["title", "text"]
      )
    }
  },
  ["title", "items"]
);

const figuresSchema = objectSchema(
  {
    title: textSchema(),
    items: {
      type: "array",
      items: objectSchema(
        {
          value: { type: "string", enum: [""] },
          label: textSchema()
        },
        ["value", "label"]
      )
    }
  },
  ["title", "items"]
);

export function standardStructuredFormat(
  field: StandardAiField,
  moduleType = ""
) {
  let name = "";
  let schema: Record<string, unknown> | null = null;

  if (field === "guidedDraft") {
    name = "ajg_guided_copy";
    schema = guidedDraftSchema as unknown as Record<string, unknown>;
  } else if (field === "qualityReview") {
    name = "ajg_copy_review";
    schema = qualityReviewSchema as unknown as Record<string, unknown>;
  } else if (field === "moduleDraft" && moduleType === "faq") {
    name = "ajg_faq_draft";
    schema = faqSchema as unknown as Record<string, unknown>;
  } else if (field === "moduleDraft" && moduleType === "benefits") {
    name = "ajg_benefits_draft";
    schema = benefitsSchema as unknown as Record<string, unknown>;
  } else if (field === "moduleDraft" && moduleType === "figures") {
    name = "ajg_figures_draft";
    schema = figuresSchema as unknown as Record<string, unknown>;
  }

  if (!schema) return null;
  return {
    type: "json_schema",
    name,
    strict: true,
    schema
  } as const;
}

function compactSingleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripPresentationMarkup(value: string) {
  let result = value
    .replace(/^\s*```(?:json|text|markdown)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/!?\[([^\]\n]+)\]\([^)\n]+\)/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "");

  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["“", "”"],
    ["«", "»"]
  ];
  for (const [start, end] of pairs) {
    if (result.startsWith(start) && result.endsWith(end)) {
      result = result.slice(start.length, -end.length).trim();
      break;
    }
  }

  result = result.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  return result.trim();
}

function truncateAtBoundary(value: string, max: number) {
  if (value.length <= max) return value;
  const candidate = value.slice(0, max + 1);
  const sentence = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? "),
    candidate.lastIndexOf("\n")
  );
  if (sentence >= Math.floor(max * 0.6)) {
    return candidate.slice(0, sentence + 1).trim();
  }
  const word = candidate.lastIndexOf(" ");
  return candidate.slice(0, word >= Math.floor(max * 0.6) ? word : max).trim();
}

export function sanitizeStandardText(
  field: StandardAiField,
  value: unknown
) {
  if (!editableFields.includes(field as EditableField)) return "";
  const editableField = field as EditableField;
  let text = stripPresentationMarkup(typeof value === "string" ? value : "");
  if (!text) return "";

  if (editableField !== "aboutText" && editableField !== "heroSubtitle") {
    text = compactSingleLine(text);
  } else {
    text = text
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return truncateAtBoundary(text, fieldLimits[editableField]);
}

export function normalizeStandardStructuredOutput(
  field: StandardAiField,
  moduleType: string,
  raw: unknown
) {
  const value = raw && typeof raw === "object" ? (raw as any) : {};

  if (field === "guidedDraft") {
    const draft = {
      heroTagline: sanitizeStandardText("heroTagline", value.heroTagline),
      heroTitle: sanitizeStandardText("heroTitle", value.heroTitle),
      heroSubtitle: sanitizeStandardText("heroSubtitle", value.heroSubtitle),
      aboutHeading: sanitizeStandardText("aboutHeading", value.aboutHeading),
      aboutText: sanitizeStandardText("aboutText", value.aboutText)
    };
    if (!draft.heroTitle || !draft.heroSubtitle || !draft.aboutText) {
      throw new Error("Incomplete guided draft");
    }
    return { draft };
  }

  if (field === "qualityReview") {
    const issues = (Array.isArray(value.issues) ? value.issues : [])
      .filter(
        (item: any) =>
          editableFields.includes(item?.field) &&
          typeof item?.reason === "string" &&
          item.reason.trim()
      )
      .slice(0, 6)
      .map((item: any) => ({
        field: item.field as EditableField,
        reason: clean(item.reason, 240)
      }));

    const suggestions = Object.fromEntries(
      (Array.isArray(value.suggestions) ? value.suggestions : [])
        .filter(
          (item: any) =>
            editableFields.includes(item?.field) &&
            typeof item?.text === "string" &&
            item.text.trim()
        )
        .slice(0, 6)
        .map((item: any): [string, string] => [
          item.field,
          sanitizeStandardText(item.field as EditableField, item.text)
        ])
        .filter((entry: [string, string]) => Boolean(entry[1]))
    );

    return { issues, suggestions };
  }

  if (field === "moduleDraft") {
    const title = clean(value.title, 100);
    const items = Array.isArray(value.items) ? value.items.slice(0, 6) : [];
    if (!title || !items.length) throw new Error("Incomplete module draft");

    if (moduleType === "faq") {
      const normalized = items
        .map((item: any) => ({
          question: clean(item?.question, 200),
          answer: clean(item?.answer, 1200)
        }))
        .filter((item: any) => item.question && item.answer);
      if (!normalized.length) throw new Error("Empty FAQ draft");
      return { draft: { title, items: normalized } };
    }

    if (moduleType === "benefits") {
      const normalized = items
        .map((item: any) => ({
          title: clean(item?.title, 100),
          text: clean(item?.text, 500)
        }))
        .filter((item: any) => item.title && item.text);
      if (!normalized.length) throw new Error("Empty benefits draft");
      return { draft: { title, items: normalized } };
    }

    const normalized = items
      .map((item: any) => ({ value: "", label: clean(item?.label, 120) }))
      .filter((item: any) => item.label);
    if (!normalized.length) throw new Error("Empty figures draft");
    return { draft: { title, items: normalized } };
  }

  throw new Error("Field is not structured");
}

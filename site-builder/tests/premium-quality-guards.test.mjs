import test from "node:test";
import assert from "node:assert/strict";
import { deterministicQualityIssues } from "../lib/premium-site-architect.ts";

function proposal(overrides = {}) {
  const base = {
    heroTagline: "Création attentive",
    heroTitle: "Des images naturelles qui vous ressemblent",
    heroSubtitle: "Une approche calme et humaine pour préparer votre séance et raconter ce qui compte vraiment.",
    aboutHeading: "Une approche simple",
    aboutText: "Je prépare chaque séance avec attention afin de créer un cadre naturel, clair et rassurant du premier échange à la livraison.",
    bookingLabel: "Parler de votre projet",
    recommendedModules: ["faq", "benefits"],
    moduleOrder: ["benefits", "faq", "gallery", "testimonials", "contact", "video", "figures"],
    faq: {
      title: "Questions fréquentes",
      items: [
        {
          question: "Comment préparer la séance ?",
          answer: "Nous échangeons en amont pour clarifier vos attentes et préparer sereinement le rendez-vous."
        }
      ]
    },
    benefits: {
      title: "Ce qui guide mon travail",
      items: [
        {
          title: "Écoute",
          text: "Un échange clair pour comprendre votre intention."
        },
        {
          title: "Simplicité",
          text: "Une expérience fluide avec des étapes faciles à suivre."
        }
      ]
    },
    architecture: {
      mode: "single",
      pages: [
        {
          id: "home",
          slug: "",
          title: "Accueil",
          kind: "home",
          purpose: "Présenter l’univers et orienter vers une prise de contact.",
          enabled: true,
          assetIds: []
        }
      ]
    },
    design: {
      layout: "showcase",
      heroLayout: "immersive",
      contentWidth: "balanced",
      accent: "#264653",
      background: "ivory",
      pattern: "none",
      patternStrength: "soft"
    }
  };
  return { ...base, ...overrides };
}

function codes(value, evidence = "") {
  return deterministicQualityIssues(value, evidence).map((issue) => issue.code);
}

test("a concise, coherent proposal passes deterministic blocking guards", () => {
  const issues = deterministicQualityIssues(proposal());
  assert.equal(issues.filter((issue) => issue.severity === "blocking").length, 0);
});

test("vague primary CTA is blocked", () => {
  assert.ok(codes(proposal({ bookingLabel: "Cliquez ici" })).includes("vague_primary_cta"));
});

test("overlong hero title is blocked for mobile readability", () => {
  assert.ok(
    codes(
      proposal({
        heroTitle:
          "Une proposition volontairement beaucoup trop longue pour tenir correctement dans un hero mobile sans nuire à la lecture"
      })
    ).includes("mobile_copy_density")
  );
});

test("single-page mode cannot keep several active pages", () => {
  const value = proposal();
  value.architecture = {
    mode: "single",
    pages: [
      ...value.architecture.pages,
      {
        id: "about",
        slug: "a-propos",
        title: "À propos",
        kind: "about",
        purpose: "Expliquer la démarche et renforcer la confiance avant la prise de contact.",
        enabled: true,
        assetIds: []
      }
    ]
  };
  assert.ok(codes(value).includes("single_mode_multiple_pages"));
});

test("an enabled page requires an editorial purpose", () => {
  const value = proposal();
  value.architecture.pages[0].purpose = "";
  assert.ok(codes(value).includes("missing_page_purpose"));
});

test("duplicate benefit titles are blocked", () => {
  const value = proposal();
  value.benefits.items[1].title = value.benefits.items[0].title;
  assert.ok(codes(value).includes("duplicate_benefit_title"));
});

test("visible section labels cannot be left empty", () => {
  const value = proposal({
    aboutHeading: "",
    bookingLabel: "",
    faq: {
      title: "",
      items: [
        {
          question: "Comment préparer la séance ?",
          answer: "Nous échangeons en amont pour clarifier vos attentes."
        }
      ]
    }
  });
  const found = codes(value);
  assert.ok(found.includes("missing_about_heading"));
  assert.ok(found.includes("missing_primary_cta_label"));
  assert.ok(found.includes("missing_faq_title"));
});

test("unsupported quantitative claims are blocked unless grounded in source evidence", () => {
  const value = proposal({
    heroSubtitle: "Une méthode qui promet 90 % de satisfaction à chaque accompagnement."
  });
  assert.ok(codes(value).includes("unsupported_quantitative_claim"));
  assert.ok(!codes(value, "Le client a fourni le chiffre 90 % dans son brief.").includes("unsupported_quantitative_claim"));
});


test("near-duplicate long copy is blocked even when wording is not identical", () => {
  const value = proposal({
    heroSubtitle:
      "Une approche humaine naturelle attentive pour préparer chaque séance avec confiance clarté sérénité écoute douceur simplicité et accompagnement.",
    aboutText:
      "Une approche humaine naturelle attentive pour préparer chaque séance avec confiance clarté sérénité écoute douceur simplicité et accompagnement personnalisé."
  });
  assert.ok(codes(value).includes("near_duplicate_copy"));
});

test("two enabled pages cannot share the same editorial purpose", () => {
  const value = proposal();
  value.architecture = {
    mode: "multi",
    pages: [
      {
        ...value.architecture.pages[0],
        purpose: "Présenter l’univers et orienter vers une prise de contact."
      },
      {
        id: "about",
        slug: "a-propos",
        title: "À propos",
        kind: "about",
        purpose: "Présenter l’univers et orienter vers une prise de contact.",
        enabled: true,
        assetIds: []
      }
    ]
  };
  assert.ok(codes(value).includes("duplicate_page_purpose"));
});


test("unsupported credibility claims are blocked unless grounded in client evidence", () => {
  const value = proposal({
    heroSubtitle:
      "Une approche certifiée et reconnue comme leader pour accompagner votre projet."
  });
  const unsupported = codes(value);
  assert.ok(unsupported.includes("unsupported_credibility_claim"));

  const evidence =
    "Le client indique explicitement être certifié et leader sur son marché local.";
  assert.ok(
    !codes(value, evidence).includes("unsupported_credibility_claim")
  );
});

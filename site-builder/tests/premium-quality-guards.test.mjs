import test from "node:test";
import assert from "node:assert/strict";
import {
  deterministicQualityIssues,
  quantitativeEvidenceText
} from "../lib/premium-site-architect.ts";

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


test("near-duplicate FAQ questions are blocked even when reworded", () => {
  const value = proposal({
    faq: {
      title: "Questions fréquentes",
      items: [
        {
          question: "Comment préparer ma séance photo en toute sérénité ?",
          answer: "Nous échangeons en amont pour clarifier vos attentes."
        },
        {
          question: "Comment bien préparer une séance photo sereinement ?",
          answer: "Je vous accompagne avec des repères simples avant le rendez-vous."
        }
      ]
    }
  });
  assert.ok(codes(value).includes("near_duplicate_faq"));
});

test("distinct FAQ questions are not treated as duplicates", () => {
  const value = proposal({
    faq: {
      title: "Questions fréquentes",
      items: [
        {
          question: "Comment préparer ma séance photo ?",
          answer: "Nous échangeons en amont pour clarifier vos attentes."
        },
        {
          question: "Où se déroule la séance ?",
          answer: "Le lieu est défini ensemble selon votre projet."
        }
      ]
    }
  });
  assert.ok(!codes(value).includes("near_duplicate_faq"));
});


test("near-duplicate benefit titles are blocked even with extra wording", () => {
  const value = proposal({
    benefits: {
      title: "Ce qui guide mon travail",
      items: [
        {
          title: "Écoute attentive",
          text: "Un échange clair pour comprendre votre intention."
        },
        {
          title: "Une écoute vraiment attentive",
          text: "Des repères simples pour adapter l’accompagnement."
        }
      ]
    }
  });
  assert.ok(codes(value).includes("near_duplicate_benefit_title"));
});

test("distinct benefit titles remain allowed", () => {
  const value = proposal();
  assert.ok(!codes(value).includes("near_duplicate_benefit_title"));
});


test("generic FAQ labels are blocked", () => {
  const value = proposal({
    faq: {
      title: "Questions fréquentes",
      items: [
        {
          question: "Question 1",
          answer: "Une réponse réelle ne suffit pas à rendre un libellé générique acceptable."
        }
      ]
    }
  });
  assert.ok(codes(value).includes("generic_faq_question"));
});

test("generic benefit titles are blocked", () => {
  const value = proposal({
    benefits: {
      title: "Ce qui guide mon travail",
      items: [
        {
          title: "Avantage 1",
          text: "Un bénéfice doit être nommé de manière compréhensible."
        }
      ]
    }
  });
  assert.ok(codes(value).includes("generic_benefit_title"));
});


test("unresolved template variables are blocked in visible copy", () => {
  const value = proposal({
    heroSubtitle:
      "Photographe à {{ville}} pour accompagner votre projet avec attention."
  });
  assert.ok(codes(value).includes("template_residue"));
});

test("normal bracket-free copy is not treated as a template residue", () => {
  const value = proposal({
    heroSubtitle:
      "Photographe à Toulouse pour accompagner votre projet avec attention."
  });
  assert.ok(!codes(value).includes("template_residue"));
});


test("raw Markdown formatting is blocked in visible Premium copy", () => {
  const value = proposal({
    heroSubtitle:
      "**Photographe à Toulouse** pour accompagner votre projet avec attention."
  });
  assert.ok(codes(value).includes("markdown_residue"));
});

test("plain text with a normal URL is not treated as Markdown", () => {
  const value = proposal({
    aboutText:
      "Retrouvez les informations pratiques sur https://example.com avant votre séance."
  });
  assert.ok(!codes(value).includes("markdown_residue"));
});

test("unsupported urgency and scarcity claims are blocked unless grounded in client evidence", () => {
  const value = proposal({
    heroSubtitle:
      "Les places sont limitées : c’est votre dernière chance pour réserver."
  });
  const unsupported = codes(value);
  assert.ok(unsupported.includes("unsupported_urgency_claim"));

  const evidence =
    "Le client précise que les places sont limitées pour cette édition et parle de dernière chance avant clôture.";
  assert.ok(
    !codes(value, evidence).includes("unsupported_urgency_claim")
  );
});

test("unsupported model meta copy is blocked unless explicitly grounded in client evidence", () => {
  const value = proposal({
    heroSubtitle:
      "Ce contenu suit le system prompt utilisé pour construire votre page."
  });
  assert.ok(codes(value).includes("unsupported_model_meta_copy"));

  const evidence =
    "Le client vend une formation consacrée au system prompt et souhaite employer précisément ce terme.";
  assert.ok(
    !codes(value, evidence).includes("unsupported_model_meta_copy")
  );
});



test("numeric grounding evidence excludes technical identifiers URLs and design metadata", () => {
  const evidence = quantitativeEvidenceText(
    {
      apiKey: "test",
      mode: "revision",
      language: "French",
      affiliationRules: "",
      instruction: "Améliore la clarté sans inventer de chiffres.",
      firstName: "Alex",
      brandName: "Studio",
      architectBrief: "Une activité créative locale.",
      revisionRequest: "Rendre le message plus direct.",
      editorialContext: "Aucune donnée chiffrée fournie.",
      currentText: "Un accompagnement simple.",
      existingProposal: {
        heroTagline: "Création attentive",
        heroTitle: "Un site clair",
        heroSubtitle: "Une présence simple et crédible.",
        aboutHeading: "À propos",
        aboutText: "Une approche personnalisée.",
        bookingLabel: "Parler du projet",
        faq: { title: "Questions", items: [] },
        benefits: { title: "Bénéfices", items: [] },
        architecture: {
          pages: [
            {
              id: "page-2026",
              slug: "offre-90",
              title: "Accueil",
              enabled: true
            }
          ]
        },
        design: {
          accent: "#123456",
          contentWidth: "1200"
        }
      }
    },
    [
      {
        id: "asset-2025",
        name: "Portrait",
        text: "",
        notes: "Photo fournie par le client.",
        sourceUrl: "https://example.com/media/75"
      }
    ]
  );

  assert.doesNotMatch(evidence, /2026|2025|123456|1200|\/75\b|offre-90/);
});

test("numeric grounding evidence preserves genuine editorial numbers", () => {
  const evidence = quantitativeEvidenceText(
    {
      apiKey: "test",
      mode: "create",
      language: "French",
      affiliationRules: "",
      instruction: "Créer une proposition fidèle.",
      firstName: "Alex",
      brandName: "Studio 54",
      architectBrief: "Le client propose 3 formules et indique 10 ans d'expérience."
    },
    [
      {
        id: "asset-999",
        name: "Offre 2",
        text: "Pack de 5 séances.",
        sourceUrl: "https://example.com/404"
      }
    ]
  );

  assert.match(evidence, /54/);
  assert.match(evidence, /3 formules/);
  assert.match(evidence, /10 ans/);
  assert.match(evidence, /Offre 2/);
  assert.match(evidence, /5 séances/);
  assert.doesNotMatch(evidence, /999|404/);
});

test("quantitative checks cover section and page titles as visible copy", () => {
  const value = proposal({
    faq: {
      title: "FAQ 90 %",
      items: [
        {
          question: "Comment préparer la séance ?",
          answer: "Nous échangeons en amont."
        }
      ]
    }
  });
  assert.ok(codes(value).includes("unsupported_quantitative_claim"));

  const pageValue = proposal();
  pageValue.architecture.pages[0].title = "Accueil 2027";
  assert.ok(codes(pageValue).includes("unsupported_quantitative_claim"));
});

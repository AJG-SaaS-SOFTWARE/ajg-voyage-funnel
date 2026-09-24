# Roadmap MVP — AJG Site Builder

## Sprint 1 — configurateur utilisable
État : en cours

- [x] branche isolée du site AJG Voyage ;
- [x] application Next.js ;
- [x] parcours en 5 étapes ;
- [x] aperçu en direct ;
- [x] validation minimale des champs ;
- [x] sauvegarde locale ;
- [x] publication locale simulée ;
- [x] conformité verrouillée ;
- [x] structure prête pour FR / EN ;
- [ ] upload réel de photos ;
- [ ] sauvegarde distante ;
- [ ] publication partageable.

## Sprint 2 — Supabase

- projet Supabase dédié ;
- Auth email / magic link ;
- tables sites, media, travel_journals, domains ;
- RLS ;
- Storage pour photos et vidéos ;
- migration du stockage local vers le repository Supabase.

## Sprint 3 — publication multi-tenant

- résolution du site par hostname ;
- sous-domaines gérés ;
- rendu public SSR/SEO ;
- statut brouillon / publié ;
- page 404 et suspension ;
- canonical / sitemap par site.

## Sprint 4 — onboarding bêta

- questionnaire simplifié ;
- assistant rédactionnel ;
- création du premier site test ;
- instrumentation des abandons ;
- journal de retours utilisateur.

## Sprint 5 — monétisation

- plans ;
- Stripe ;
- quotas ;
- domaine personnalisé ;
- back-office administrateur ;
- suspension automatique en cas d'impayé.

## Principe de conformité

Les mentions MWR Life / Travel Advantage, lorsqu'elles sont nécessaires, restent des blocs système non éditables par le membre. Les contenus marketing créés par l'utilisateur devront rester séparés des matériaux officiellement approuvés.

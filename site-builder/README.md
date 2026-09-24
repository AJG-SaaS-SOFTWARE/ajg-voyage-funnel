# AJG Site Builder

AJG Site Builder est le prototype SaaS multi-tenant destiné à permettre aux membres du réseau de créer, personnaliser et publier leur propre site à partir d'un moteur commun.

## État actuel — Prototype 0.6.2

Le prototype comprend déjà :

- une interface premium et responsive ;
- une connexion Supabase par Magic Link ;
- un builder guidé en 5 étapes ;
- une prévisualisation en direct ;
- une sauvegarde locale automatique pour éviter la perte de saisie ;
- une sauvegarde cloud Supabase ;
- l'upload d'une photo de profil ;
- une publication partageable ;
- une résolution par sous-domaine géré ;
- un rendu public SSR avec métadonnées SEO ;
- des blocs de conformité centralisés et non éditables.

## Architecture

1. Frontend et rendu public : Next.js sur Vercel.
2. Authentification, données et médias : Supabase.
3. Multi-tenant : un seul moteur, un enregistrement de site par membre.
4. Sous-domaines réseau : `prenom.voyage.ajgsolutionsgroup.com`.
5. Domaines personnalisés : prévus dans une phase commerciale ultérieure.
6. IA : couche future pour aider à rédiger les textes sans retirer le contrôle à l'utilisateur.
7. Conformité : mentions obligatoires verrouillées dans le template.

## Principe produit

Le produit ne clone pas un dépôt ou une application par membre. Le code, le design et les corrections restent centralisés ; chaque client possède sa configuration, ses médias et son adresse publique.

Voir `docs/mvp-roadmap.md` pour la suite du développement.

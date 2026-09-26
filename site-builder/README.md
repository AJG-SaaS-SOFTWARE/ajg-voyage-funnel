# AJG Site Builder

AJG Site Builder est le prototype SaaS multi-tenant destiné à permettre aux membres du réseau de créer, personnaliser et publier leur propre site à partir d'un moteur commun.

## État actuel — Prototype bêta

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
- des blocs de conformité centralisés et non éditables ;
- un assistant IA pour le parcours guidé et les champs éditoriaux ;
- des actions rapides de reformulation qui ne remplacent jamais le texte sans validation ;
- un Quality Check avant publication avec relecture éditoriale assistée ;
- l'import de photos de fond optimisées avec positionnement intelligent ;
- des modules facultatifs (galerie, FAQ, témoignages, contact, vidéo, chiffres clés, avantages) réordonnables.

## Architecture

1. Frontend et rendu public : Next.js sur Vercel.
2. Authentification, données et médias : Supabase.
3. Multi-tenant : un seul moteur, un enregistrement de site par membre.
4. Sous-domaines réseau : `prenom.voyage.ajgsolutionsgroup.com`.
5. Domaines personnalisés : prévus dans une phase commerciale ultérieure.
6. IA : génération côté serveur via `/api/ai/write`, quotas côté Supabase et validation utilisateur avant remplacement.
7. Conformité : mentions obligatoires verrouillées dans le template.

## Principe produit

Le produit ne clone pas un dépôt ou une application par membre. Le code, le design et les corrections restent centralisés ; chaque client possède sa configuration, ses médias et son adresse publique.

Voir `docs/mvp-roadmap.md` pour la suite du développement.


## Assistant IA dans les champs

Les champs éditoriaux à forte valeur (accroche, titre, introduction, présentation et appel à l'action)
peuvent être rédigés ou reformulés depuis le builder. L'utilisateur écrit sa demande en langage naturel,
la proposition est insérée dans le champ, puis reste entièrement modifiable avant sauvegarde ou publication.

L'appel au modèle passe uniquement par `/api/ai/write` côté serveur. La clé `OPENAI_API_KEY` ne doit jamais
être exposée au navigateur. Le modèle par défaut est configurable via `OPENAI_TEXT_MODEL`.

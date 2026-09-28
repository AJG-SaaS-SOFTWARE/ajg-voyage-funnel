# Recette bêta — AJG Site Builder

Dernière mise à jour : 27 septembre 2026.

## Pré-déploiement automatisé

- `npm ci`
- `npx tsc --noEmit`
- `npm run build`
- `npm test` : validation du format de l’archive de récupération streamée.
- `npm run test:smoke` : démarrage réel du build avec `next start`, contrôle des pages principales, 404 et garde d’authentification de l’export.
- CI GitHub dédiée au dossier `site-builder/`.
- Déploiements Git automatiques Vercel désactivés pour éviter de consommer le quota Hobby à chaque commit.
- Release production dédiée : workflow manuel `Site Builder Production Release`, build précompilé dans GitHub Actions, déploiement production en mode staged (`--skip-domain`), smoke test, puis promotion seulement si les contrôles passent.
- Déclenchement possible sans l’interface GitHub : la branche réservée `release/site-builder-production` doit pointer exactement sur le `main` courant ; le workflow refuse une branche de release obsolète.
- Avant promotion, le workflow résout l’alias public actuel et mémorise son `deploymentId` comme cible de rollback. Si `/api/health` ou `/login` échoue après promotion, il demande automatiquement le rollback vers cette version puis termine en échec.
- Prérequis externe : secret GitHub Actions `VERCEL_TOKEN` autorisé sur l’équipe/projet AJG ; les IDs équipe/projet ne sont pas secrets et restent versionnés dans le workflow.
- Premier déclenchement contrôlé du 28 septembre 2026 : workflow correctement lancé par la branche réservée, arrêté au préflight car `VERCEL_TOKEN` est absent des secrets GitHub Actions ; aucune requête de déploiement Vercel n’a été envoyée.
- Aucun secret de production requis pour compiler : la CI utilise uniquement des valeurs publiques factices pour Supabase.

## Parcours de recette après réouverture du build Vercel

1. Authentification par magic link et reprise d’un brouillon existant.
2. Création guidée 3+1, génération des textes puis modification manuelle.
3. AI Site Architect : génération complète, refus de l’application, nouvelle génération, application explicite.
4. Bibliothèque : image, audio, PDF/TXT, droits inconnus, contenu possédé, contenu sous licence avec source.
5. Vérifier qu’un contenu aux droits inconnus ou sous licence sans source ne peut pas être publié/affecté.
6. Révision globale : demander une évolution du ton, une modification de structure et une utilisation de contenu ; vérifier que le site courant reste intact avant validation.
7. Arborescence : ajout, suppression, ordre, activation, slugs, page d’accueil protégée et affectation manuelle des contenus.
8. Quality Check : liens, légal/RGPD, contraste, responsive, droits, architecture et affectations.
9. Publication puis contrôle des routes accueil, sous-pages, pages légales, sitemap et 404.
10. Contrôle mobile étroit et desktop large, notamment hero, navigation, médias et audio.
11. Contrôle du sous-domaine géré et des canonical/metadata.
12. Contrôle des logs runtime après le parcours complet.

## Critères bloquants

Une bêta n’est pas validée si : le build/typecheck échoue ; un site non publié devient public ; un utilisateur peut lire/modifier le brouillon d’un autre ; un contenu non autorisé est rendu public ; une révision IA s’applique sans validation humaine ; une route publique critique renvoie 5xx ; le sous-domaine/canonical pointe vers un autre site.

## Sécurité vérifiée avant recette

- `site-media` : 15 Mo, MIME bornés côté bucket et application.
- `ai_usage_events` : aucun accès direct anon/authenticated.
- `consume_ai_generation` : anon interdit ; authenticated/service_role autorisés ; contrôle `auth.uid()` et plafonds conservés.
- Les pages de planification internes (`purpose`) ne sont plus rendues ni utilisées comme description SEO.
- Les pages légales `noindex` ne sont pas ajoutées au sitemap.
- Architecture normalisée : une seule home, slugs non vides et uniques, IDs/assetIds dédupliqués.
- Contenus licensed/public-domain : source HTTPS requise avant statut publiable.

## Blocages externes actuels

- Vercel refuse actuellement les nouveaux builds pour limite de build du compte ; la dernière production READY est donc antérieure aux itérations 4A–4C.
- La protection Supabase contre les mots de passe compromis doit être activée depuis la configuration Auth si l’offre du projet la rend disponible.

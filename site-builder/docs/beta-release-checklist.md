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
- Release production dédiée : workflow `Site Builder Production Release` via l’API REST Vercel. Après la CI, il crée un déploiement `target=production` atomique à partir de la production actuelle avec le dernier commit, en héritant des réglages/envs. L’ancien déploiement est mémorisé avant création ; le nouveau doit être `READY`, cibler `production` et porter le SHA attendu, puis il est promu explicitement via l’API Vercel (sans rebuild) et l’alias public subit le contrôle HTTP complet avec plusieurs tentatives avant rollback.
- Déclenchement possible sans l’interface GitHub : la branche réservée `release/site-builder-production` doit pointer exactement sur le `main` courant ; le workflow refuse une branche de release obsolète.
- Avant promotion, le workflow résout l’alias public actuel et mémorise son `deploymentId` comme cible de rollback. Si `/api/health` ou `/login` échoue après promotion, il demande automatiquement le rollback vers cette version puis termine en échec.
- Prérequis externe : secret GitHub Actions `VERCEL_TOKEN` autorisé sur l’équipe/projet AJG. Le workflow vérifie l’accès projet via REST avant toute création de déploiement.
- `site-private-media` est initialisé depuis le back-office admin authentifié via `/api/admin/storage-bootstrap`. La clé Supabase Production est une variable Vercel Sensitive et n’est volontairement pas récupérable par le workflow CI.
- Le back-office propose ensuite un test E2E Storage sans modifier le site : fichier TXT temporaire dans le bucket privé, contrôle d’inaccessibilité publique, appel de `/api/media/promote`, lecture publique de la copie, puis nettoyage.
- Le token GitHub Actions est opérationnel sur l’API projet Vercel. Le chemin CLI a été abandonné car les PAT récemment émis retournaient `User not found` sur `/v2/user`, alors que les endpoints projet fonctionnaient.
- Aucun secret de production requis pour compiler : la CI utilise uniquement des valeurs publiques factices pour Supabase.

## Vérification du déploiement

Avant toute recette réelle, exécuter `npm run verify:deployment -- --url=https://<deployment> --sha=<sha-main>` afin de vérifier `/api/health`, le SHA réellement servi et les routes critiques non authentifiées. Une recette ne doit pas être déclarée valide si le SHA attendu n’est pas celui exposé par l’environnement.

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

- Dernier blocage identifié : `functionFailoverRegions` demandait une région passive `fra1`, fonctionnalité réservée à Enterprise. Ce réglage a été retiré ; `cdg1` reste la région principale et la release doit être retentée.
- La protection Supabase contre les mots de passe compromis doit être activée depuis la configuration Auth si l’offre du projet la rend disponible.

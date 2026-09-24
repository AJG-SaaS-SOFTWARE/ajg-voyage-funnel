# Configuration Supabase — AJG Site Builder

Projet dédié :
- nom : AJG Site Builder
- région : eu-west-3 (Paris)
- project ref : scxluqvigqgkquqwrseg
- URL : https://scxluqvigqgkquqwrseg.supabase.co

## Variables nécessaires

Dans Vercel, renseigner pour le projet du builder :

```text
NEXT_PUBLIC_SUPABASE_URL=https://scxluqvigqgkquqwrseg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key du projet>
```

Ne pas utiliser de clé service_role côté navigateur.

## Auth

Le prototype utilise les Magic Links Supabase.

Après création de l'URL Vercel du builder :
1. ouvrir Supabase > Authentication > URL Configuration ;
2. mettre l'URL publique du builder en Site URL ;
3. ajouter l'URL de preview Vercel si nécessaire dans Redirect URLs ;
4. conserver /builder comme destination après connexion.

## Base créée

Tables :
- sites
- media
- travel_journals
- domains

Row Level Security est activé sur les quatre tables.

Le bucket public `site-media` accepte :
- JPEG
- PNG
- WebP
- AVIF
- MP4
- WebM

Les écritures Storage sont limitées au dossier correspondant à l'ID de l'utilisateur authentifié.

## Publication actuelle

Quand Supabase est configuré :
- le builder exige une session utilisateur ;
- Sauvegarder écrit dans `sites` avec le statut `draft` ;
- Publier écrit le statut `published` ;
- `/site/[slug]` sait lire publiquement un site publié ;
- l'upload de photo de profil utilise le bucket `site-media`.

Le routage réel par sous-domaine sera ajouté après le premier déploiement Vercel.

# Assistant de rédaction IA — AJG Site Builder

## Objectif

Permettre à un utilisateur novice de choisir entre trois méthodes :
1. écrire lui-même ;
2. utiliser le questionnaire guidé sans IA ;
3. demander à l'IA de rédiger ou reformuler un champ précis à partir d'une consigne libre.

Le résultat de l'IA est toujours inséré dans un champ éditable. La publication ne se fait jamais automatiquement.

## Champs activés

- petite phrase d'accroche ;
- titre principal ;
- introduction ;
- titre de la présentation ;
- présentation personnelle ;
- libellé du bouton de rendez-vous.

Les champs techniques (nom, slug, URL, réseaux sociaux, paramètres de conformité) ne sont pas générés par l'IA.

## Sécurité

- appel OpenAI uniquement depuis une route serveur Next.js ;
- authentification Supabase requise avant chaque génération ;
- clé OpenAI stockée côté serveur dans `OPENAI_API_KEY` ;
- champs et longueurs autorisés contrôlés côté serveur ;
- aucune consigne utilisateur n'est exécutée comme du code ;
- aucune affirmation commerciale, économie, revenu, prix, garantie ou affiliation ne doit être inventée ;
- pour un site indépendant, MWR Life et Travel Advantage ne doivent pas être introduits sans demande explicite.

## Activation

Ajouter sur Vercel, pour les environnements souhaités :

- `OPENAI_API_KEY` — secret serveur ;
- `OPENAI_TEXT_MODEL` — optionnel, valeur par défaut : `gpt-5.6-luna`.

Après ajout du secret, redéployer le projet.

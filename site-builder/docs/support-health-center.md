# AJG Site Builder — Health Center & support tickets

Date : 30 septembre 2026.

## Objectif

Réduire le support humain en exécutant un diagnostic déterministe avant toute escalade AJG.

Le premier socle couvre :

- disponibilité du backend pendant la demande ;
- statut de publication et suspension publique ;
- état connu des domaines ;
- état de facturation ;
- ticket structuré avec diagnostic figé au moment de la demande ;
- action client proposée lorsque le problème est identifiable ;
- file d'administration séparant action client, incident et résolution.

Aucun LLM n'est utilisé pour ce diagnostic. Aucun mot de passe, clé API, donnée bancaire, contenu de site ou historique de navigation n'est collecté automatiquement.

## Sécurité

Les clients ne peuvent pas insérer ou modifier directement la table de tickets via la Data API. La création passe par l'API support, qui vérifie le JWT puis limite le diagnostic aux sites possédés par l'utilisateur. Les clients peuvent lire leurs tickets via RLS. L'administration passe par une API qui revérifie le rôle admin en base avant de créer le client service.

## États initiaux

- waiting_customer : une cause déterministe et une action client ont été identifiées sans incident technique ;
- diagnosed : diagnostic attaché et intervention AJG potentiellement nécessaire ;
- in_progress : traitement AJG ;
- resolved / closed : terminé.

## Limites de ce bloc

Ce premier Health Center ne vérifie pas encore directement HTTPS externe, formulaires, liens cassés, rendu, sitemap, latence ou erreurs runtime Vercel par site. Il ne déclenche aucune réparation automatique. Ces contrôles doivent être ajoutés progressivement et chaque auto-remédiation devra être sûre, idempotente, journalisée et réversible.

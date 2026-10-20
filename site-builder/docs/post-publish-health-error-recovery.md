# Récupération visible du diagnostic après publication

## Parcours couvert

Quand le diagnostic après publication devient temporairement indisponible, le Builder conserve désormais deux actions visibles en français et en anglais :

- ouvrir le Health Center ;
- relancer explicitement le diagnostic.

La relance réutilise le gestionnaire déjà protégé par une lecture de session bornée, une requête de santé bornée et la validation stricte de la réponse. Aucun appel automatique supplémentaire, aucune mutation Auth, aucun changement de droits et aucun appel IA ne sont ajoutés.

## Preuve

Le test structurel `post-publish-health-error-recovery.test.mjs` localise dans l’AST TSX la branche réellement rendue pour `postPublishHealthState === "error"`. Il vérifie la présence du lien Support, du bouton bilingue et de son câblage direct vers `retryPostPublishHealth`.

Limite : cette preuve CI ne remplace pas un parcours navigateur avec une identité ordinaire et une boîte mail autorisée.

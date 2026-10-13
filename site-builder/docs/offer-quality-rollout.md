# Alignement qualité/offres — 13 octobre 2026

Essentiel aide à écrire et modifier ; il ne crée pas automatiquement le site complet. Growth mensuel ajoute des améliorations ciblées, pas une refonte globale gratuite. Une création ou refonte complète consomme un crédit BUILD. Growth annuel inclut un paquet BUILD par période annuelle effectivement payée ; le paquet expire à la fin de la période. Les itérations internes restent bornées par les réservations existantes, elles ne signifient pas plusieurs créations commerciales offertes.

Prix client actif : 39 € via `STRIPE_AI_LAUNCH_ACTIVE_CLIENT_PRICE_ID`, contrôlé côté Stripe avant création du Checkout. Pas de fallback à 49 € si ce prix n'est pas configuré. Le prix public 49 € reste distinct. L'achat sans abonnement et le parcours hébergement dépendent de la PR #450 et de ses migrations, non intégrées par cette tranche.

L'ancien gate `AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH` ne définit plus l'offre annuelle : l'inclusion a été validée dans la grille officielle. Les gates Checkout, juridiques, fiscaux et fournisseur restent indépendants et fermés tant que non approuvés. Rien ici n'ouvre les encaissements live.

Ordre nécessaire :
1. Revue du code et des tests SQL isolés.
2. Préflight du schéma complet et sauvegarde des définitions des deux fonctions concernées.
3. Migration `20261013184716_align_full_build_offer_rights.sql` avant publication du code. Elle retire les révisions Growth non décomptées et lie l'idempotence au propriétaire, au site et au type d'opération.
4. Configuration et contrôle du Price client actif à 39 €, puis recette sandbox complète.
5. Release et recettes FR/EN, avec coût/durée conservés dans `builder_e2e_runs.steps` avant nettoyage des comptes temporaires.

La route refuse les anciennes réponses `unmetered_growth` : publier sans migration pourrait donc empêcher la refonte d'un client Growth possédant un crédit. Ce contrôle est volontairement fermé ; ne pas contourner le garde-fou pour rétablir un accès gratuit.

Le temps total de la pipeline IA dispose d'une deadline de 80 secondes (route 90 secondes). Elle peut interrompre une chaîne de corrections trop longue ; contrôler le taux de résultats utiles et les coûts incertains avant d'ajuster ce budget.

Le benchmark mesure coûts cumulés par résultat accepté et latence. Il n'élit pas automatiquement un modèle et n'affirme aucune économie réelle sans données. L'exactitude éditoriale, la qualité visuelle et la satisfaction doivent toujours être évaluées.

Les quotas métier Growth 4 diagnostics / 8 sections / 20 variantes ne sont pas implémentés par cette tranche : les contrôles monétaires/rate limits existants restent actifs. Définir les unités d'usage et implémenter une réservation atomique dédiée avant de présenter ces nombres comme quotas actifs. Les limites quotidiennes/hebdomadaires, la promotion de trois mois et le prix remisé de lancement ne sont pas inventés ici.

Restent également à prouver : domaine personnel de test, cycle Stripe fournisseur complet, restauration complète médias/journaux, tests d'autonomie client et activation/puis valeur à 30 jours. Les recettes synthétiques ne sont pas une preuve de CSAT 98 %.

# Reporting Cockpit — authentification serveur

Suivi : WOR-183. Le endpoint `/api/health/business` reste réservé au cockpit.

- `AJG_COCKPIT_REPORTING_TOKEN` : au moins 32 caractères, secret serveur uniquement.
- En-tête exact `Authorization: Bearer <token>` ; aucun espace ajouté au token.
- Comparaison constante si les longueurs en octets sont identiques ; credentials incorrects rejetés sans exception.
- Configuration absente/courte : accès refusé. Aucun accès de secours public.
- Aucun changement des agrégats, des droits métier, des migrations ni des flags de paiement.

Avant release : qualité/CI/E2E et revue sécurité ; vérifier une requête autorisée et une requête refusée avec le cockpit. Ne jamais journaliser le token.

Compatibilité : un ancien token de 24 à 31 caractères doit être remplacé dans Builder et dans le cockpit avant déploiement. La nouvelle règle refuse ces anciennes configurations.

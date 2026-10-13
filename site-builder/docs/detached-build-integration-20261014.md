# Création IA sans abonnement — intégration sur main du 14 octobre

Reprise de #450 sur le SHA 8a8ef29, avec conservation des corrections #462/#463. Cette branche ne doit pas être remplacée par la tête ancienne de #450.

- BUILD seul : 49 € public ; client Essentiel/Growth actif et payé : 39 €, Price strict distinct sans fallback.
- Pas d'hébergement/publication/import/export/collecte de prospects accordés au plan gratuit par BUILD ; la création prépare un brouillon dans l'éditeur, publication ensuite avec abonnement choisi explicitement.
- Un abonnement payé devenu inactif doit être régularisé avant un nouvel achat, pour éviter de vendre une génération inutilisable.
- Refus des réponses illisibles du ledger ; paiement ponctuel explicitement settled, et replay ne réinitialisant pas les opérations.
- Souscriptions déjà existantes y compris pending/incomplete : portail, sans seconde souscription ; relecture du site sélectionné, verrou de paiement frontend et idempotence Stripe par tentative.
- Le timeout Stripe et la validation de réponse sont conservés ; pas de retry automatique des mutations. L'idempotence par tentative ne démontre pas la prévention de deux achats volontaires simultanés entre onglets.
- Customer Portal : les quatre prix d'abonnement doivent être réellement sélectionnables, pas seulement un toggle enabled.
- Deadline IA 80 secondes, annualité unique et remboursement des réservations restent ceux de #463.

Activation désactivée (`AJG_DETACHED_AI_LAUNCH_ENABLED=false`). Les deux SQL sous docs/migrations sont des candidats, non des migrations appliquées. Le test PGlite exerce réellement les fonctions sur schéma réduit : achat Stripe vs promotion, absence de RUN, expiry, usage, propriétaire, repère de quota et idempotence. Il ne remplace pas un préflight sur le schéma Supabase complet ni un paiement fournisseur sandbox complet. Le test ne démontre pas concurrence multi-session ou installation production.

Avant activation : migration versionnée via CLI après préflight, recette isolée complète création payée49€/39€, échec/retry/remboursement de capacité, souscription ultérieure Essentiel et publication, canary et preuves SHA. Aucun encaissement live ni changement Supabase réalisé par cette intégration. Quotas Growth 4/8/20 restent séparés et non livrés ici.

# ELTARA — recette de lancement AI Launch autonome et RUN (12 octobre 2026)

Statut : **NO-GO production** tant que les preuves ci-dessous ne sont pas collectées. La CI verte ne valide pas les fonctions PostgreSQL réellement installées.

## Pré-vol (sandbox uniquement)
- Vérifier la CI du SHA candidat : tests, lint, TypeScript, build, smoke.
- Comparer les définitions effectives des RPC en Supabase staging aux migrations versionnées et au bon ordre de migration.
- Ne pas changer `AJG_BILLING_CHECKOUT_ENABLED` ni `AJG_DETACHED_AI_LAUNCH_ENABLED` en production; configurer uniquement un environnement staging isolé.
- Capturer le montant Stripe one-shot 49 € et les 4 prix RUN/GROW depuis la plateforme de test; aucun Price ID fourni par le navigateur.
- Prendre un état initial des droits pour trois utilisateurs distincts, sans droit RUN.

## Cas critiques (preuves HTTP + DB avant/après)
| ID | Scénario | Attendu |
| --- | --- | --- |
| B01 | Preview gratuit, requête field/architect/publish | Aucun appel fournisseur; publication refusée |
| B02 | AI Launch one-shot Checkout réussi, webhook payé et rejoué | Un seul droit BUILD; aucun abonnement RUN |
| B03 | Webhook non payé, événement incomplet ou signature invalide | Aucun droit BUILD |
| B04 | BUILD acheté, création siteArchitect | Réservation quota/monétaire et droit BUILD, résultat exploitable |
| B05 | BUILD acheté, champ rédactionnel simple | Refus avant tout appel fournisseur |
| B06 | BUILD acheté, publication, domaine, média hébergé | Refus avant effet public/coût |
| B07 | BUILD acheté, génération en échec/transitoire | Quota client libéré selon politique, dépenses fournisseur conservées |
| B08 | Répétition de la même requête et concurrence | Un seul débit de capacité; aucune double dépense intentionnelle |
| B09 | BUILD épuisé ou expiré / utilisateur tiers | Refus IA, édition du brouillon conforme à la politique |
| B10 | Souscrire Essentiel après BUILD | Publication autorisée après confirmation de paiement; droits IA limités à Essentiel |
| B11 | Annuler / ne pas renouveler Essentiel | Publication et appels coûteux suivent politique impayés; données conservées conformément à la rétention |
| B12 | Growth annuel et offre BUILD incluse désactivée | Aucun BUILD gratuit |
| B13 | Trois sites propriétaires distincts | Aucune lecture, modification ou publication intercomptes |
| B14 | Redéploiement, sauvegarde/restauration, DNS/HTTPS | Contenu et domaines stables, preuve de restauration |
| B15 | Fournisseur IA indisponible et budget consommé | Fail-closed; site publié conserve son accès public |

## Risques identifiés
- La migration de capacité BUILD autorise globalement `can_generate_ai` pour un achat payé; **l'endpoint IA distingue les champs autorisés**, mais l'audit de toutes les autres API et des usages futurs reste requis.
- La migration quota pour compte free accepte un droit BUILD acheté et applique des plafonds minute/jour/mois; vérifier que la réservation du droit BUILD et le ledger fournisseur sont atomiques chacun dans leur transaction, et réconciliés sur échec.
- Les coûts IA sont actuellement estimés en USD; aucun seuil de marge EUR ne doit être présenté comme observé sans taux FX daté et relevé fournisseur.
- Un droit BUILD indépendant ne finance pas RUN. Pas de vente « site en ligne à vie » pour 49 €.

## Garde de décision
GO bêta payante limitée seulement après : tests B01–B15, vérification des coûts P50/P95 par création, rapport mensuel par site, inventaire facture hébergement/stockage/egress, contrôle juridique/taxe et approbation explicite d'activation. Toute anomalie de privilèges, quota ou paiement = NO-GO.


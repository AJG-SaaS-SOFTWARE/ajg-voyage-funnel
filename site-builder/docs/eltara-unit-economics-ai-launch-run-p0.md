# ELTARA — P0: coût complet et parcours AI Launch → RUN (12 octobre 2026)

Statut : spécification opérationnelle en chantier, aucun changement de production, aucun prix Stripe live activé.

## État audité
- `lib/ai-provider-budget.ts` réserve les budgets fournisseur de manière transactionnelle et rapproche les tokens rapportés; plafonds par compte, site, période et BUILD. Ne pas dupliquer ce moteur.
- `/admin/finops` fournit les coûts IA USD estimés; la documentation constate l'absence de réconciliation factures et de coûts bêta réels suffisants.
- L'offre commerciale actuelle est BUILD 49 € une fois, RUN Essentiel 15 €/mois (150 €/an), RUN+GROW 29 €/mois (290 €/an).
- Pas de vente live avant gates existants Stripe, juridiques et fiscaux.

## Décision commerciale et contractuelle
1. **AI Launch = création uniquement** : 49 € unitaire, pas d'hébergement public permanent implicite. Le droit BUILD peut être acheté séparément, et ne déclenche jamais à lui seul une publication publique.
2. **AI Launch + Essentiel = parcours par défaut recommandé** : achat BUILD, visualisation/validation en brouillon, puis souscription Essentiel (RUN) pour publication, hébergement, HTTPS, sauvegardes, éditeur, domaine et services du plan. Ne pas créer une remise « hébergement seul » à ce stade : conserver 15 €/mois et distinguer création ponctuelle de l'édition continue. Le client peut modifier son site dans Essentiel, mais la **création complète par IA** n'est pas réaccordée par RUN.
3. **AI Launch + Growth** : montée en gamme volontaire pour GROW, jamais exigée pour publier un site déjà conçu.
4. **Export/hébergement externe** : proposer un export exploitable et documenté comme alternative non captive; détailler les éléments non transférables, désactivation éventuelle des fonctionnalités hébergées, limites et responsabilités du client. Aucun hébergement externe ou portabilité totale ne doit être promis avant recette réelle du format exporté.
5. Site non payé : brouillon conservé selon politique de rétention, publication et appels IA coûteux bloqués conformément aux règles de facturation, sans suppression silencieuse des contenus.

## Architecture fonctionnelle et critères d'acceptation P0
- Séparer explicitement `build_entitlement` (droit ponctuel) de `run_subscription` (hébergement/édition). Ne jamais confondre acquisition BUILD et autorisation de publier.
- Checkout permet l'achat BUILD sans forcer de souscription, puis propose Essentiel/Growth après la génération. Aucun achat récurrent implicite : consentement explicite.
- Les endpoints de publication, domaine, récupération et génération valident leurs droits côté serveur, sans faire confiance au plan dans le navigateur.
- Si BUILD réussit mais Checkout RUN échoue, le site reste accessible au propriétaire en brouillon, aucune publication anonyme.
- Tester : BUILD seul, BUILD+Essentiel, BUILD+Growth, paiement échoué, annulation, reprise, export, changement de domaine, réabonnement, duplication de webhook, création facturée sans lancement réussi.
- Pas d'activation de la promotion Growth annuel / BUILD offert avant preuve du coût P95.

## Ledger économique à créer — séparé du ledger IA
Un événement de coût non-IA porte `site_id` (nullable seulement si coût réellement mutualisé), `account_id`, `category`, `provider`, `metric`, `quantity`, `unit`, `period_start`, `period_end`, `cost_currency`, `cost_amount`, `source_invoice_or_usage_id`, `allocation_method`, `estimated`, `recorded_at`.
Catégories obligatoires : bandwidth/egress, requests/compute, storage, backup, image/media processing, email, domain/dns, observability, provider fees, payment fees.
Index d'idempotence fournisseur/période/site/catégorie; service-only; réconciliation à chaque cycle de facture; coûts communs répartis par règle explicite et historisée. La facture fournisseur reste la source comptable autoritaire.

## Politique de coût cible (non promesse commerciale)
- Objectif marge contributive >=80 % par formule, après coûts variables et frais de paiement, en **EUR hors taxes**.
- Le plafond RUN IA en USD (Essentiel 1 $/mois; Growth 6 $/mois dans le garde actuel) n'est **pas** le budget complet; inclure hébergement et FX. Ne pas inférer USD = EUR.
- Admission automatique de nouveaux sites seulement après seuils de charge et marge testés; fail-closed sur actions coûteuses, ne pas interrompre un site publié à cause d'un budget IA.
- Alerte interne aux seuils de marge projetée 80/70/60 %, sans couper arbitrairement le site client.
- Limiter les consommations abusives par politiques équitables annoncées (stockage, bande passante, trafic excessif, taille médias, génération et fréquence des sauvegardes); ne jamais vendre « illimité » sans borne.

## Séquence d'implémentation
1. Contrôler le routage réellement déployé des coûts IA, fixtures SQL et dépenses incertaines.
2. Exporter les métriques agrégées fournisseur (Vercel/OpenAI/stockage/email) sans exposer secrets; rapprocher en EUR avec FX historisé.
3. Construire la vue `unit_economics_by_account_site_month` : revenu HT reconnu, frais paiement, IA coût USD converti, hosting alloué, autres coûts; montrer marge, réserves et incertitudes; distinguer site jamais publié.
4. Mettre des plafonds mesurés côté serveur sur les opérations facturables, publication et média.
5. Recette E2E 3 sites de clients distincts, avec redéploiement, sauvegarde/restauration, domaines, 3 niveaux de trafic et compteurs fournisseurs.
6. Rapporter médiane/P95 de BUILD et coût RUN/plan, puis décider GO/NO-GO.

## Non-objectifs
Pas de mutation de DB production, aucune modification de tarif ou secret, pas de bascule de provider d'hébergement, pas d'activation de Stripe live dans ce chantier.

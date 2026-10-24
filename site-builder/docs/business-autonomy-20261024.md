# ELTARA — audit de commercialisation et d’autonomie, 24 octobre 2026

## Conclusion opérationnelle

ELTARA dispose de circuits techniques de facturation, publication, support,
surveillance et sauvegarde. Cela ne constitue pas encore un business commercial
autonome. Les neuf spécialistes du Business OS sont définis dans une branche
encore en brouillon ; leur présence ne prouve pas un service commercial déployé.
Ventes fermées, aucune campagne, paiement live ou inférence payante autorisés.

Audit depuis Builder main `b8219b5bc03e92b81cf6560bab65aa99b8b21501` (#583)
et Cockpit main `8fb3fb9c594c1eaf93d598785a86594f4458f6a1`. GitHub et Vercel
ont été relus le 24 octobre. Production publique indépendante à 09:54:38 UTC :
service/base OK, SHA exact, déploiement `dpl_BnYZZNEjJWfB2nMJ2tSYyX2jWXwJ`.
CI main `40066898638`, release `40067028152`, revue visuelle `40067291354` et
uptime `40067663730` : SUCCESS. Les limites de #583 restent applicables.

## Agents et circuits réellement identifiés

| Circuit | Code / raccordement | Preuve disponible | Ce qui reste à établir |
| --- | --- | --- | --- |
| Développement / release | CI, branche release Builder isolée, recettes, captures et vérification de SHA | PR #583 et runs ci-dessus | Le pilote externe de développement ne garantit pas une exécution continue ni une réparation produit autonome |
| RUN central | Cron Cockpit, Intake privé, routage, outboxes/CAS, correcteur borné | Cycle naturel 24/10 09:15:33 UTC frais ; routage/agent sans échec | Cycle toujours critical : un productSyncFailure et deux stalledCorrectiveWorkItems ; provenance privée #525/#526 non acquise |
| Support produit | `/api/cron/support-operations`, réconciliation, sweep borné, audit et confirmation centrale | SELECT technique ciblé : journal du 24/10 09:20:21–09:20:24 UTC healthy/runtime healthy | Journal seul ne prouve pas une réparation naturelle ; `reported_to_run=false` n’est pas un échec de livraison en l’absence d’incident à transmettre |
| Suivi bêta | `/api/cron/beta-operations`, journal et préparation des candidats de suivi | SELECT technique ciblé : 24/10 07:05:14–07:05:15 UTC attention, zéro repair_failures, deux follow_up_candidates | Pas de preuve d’envoi automatique ; ne pas envoyer de relances sur cette seule candidature |
| Facturation / droits | Checkout/Portal et webhooks produit, droits serveur ; Cockpit financier en lecture seule | Cycles fournisseur Stripe sandbox et recettes techniques de release | Compte ordinaire → email reçu → navigateur → Checkout → droits → publication reste non prouvé ; pas d’ouverture live |
| Domaines | Raccordement et remédiation technique des domaines gérés | Recettes isolées et audits existants | DNS externe et achat/renouvellement registrar non prouvés ; aucune autorisation d’achat ou de DNS sensible déduite |
| FinOps / IA | Quotas, admissions, métriques et surveillance ; paid AI E2E manuel/désactivé par défaut | Tests et contrôles techniques existants | Qualité/coût/marge réelle non mesurés ici ; absence de nouvel appel ne prouve pas la résolution de l’ancien crédit épuisé |
| Sauvegarde | Cron journalier et health dédiés | Circuit existant, recettes et watchdogs livrés | Une santé déclarée ne remplace pas une restauration métier complète ; aucun backup global déclenché dans cet audit |
| Courrier AJG | Pilote externe AJG Mail Triage actif, périmètre qualifié et brouillons seulement | Configuration relue ; dernier passage enregistré le 24/10 à 09:03 UTC | Ce n’est pas un agent de vente ou d’envoi autonome ; aucune boîte ordinaire de recette distincte autorisée |
| Business OS commercial | PR Cockpit #224 **draft**, head `51f6dc1831accd2d9e31088690853fca3b44fb71` | Registre/politiques, worker pilote, adaptateurs et scripts candidats dans la branche | Absents de main ; raccordement production, rôle limité, persistance, exécution et livraison ne sont pas prouvés |

Les cinq crons Builder dans `vercel.json` sont facturation (08:15 UTC), sauvegarde
(02:40), bêta (07:05), support (chaque heure à :20) et E2E structurel (:25).
Configuration d’un cron, exécution d’un journal, test synthétique, recette serveur
avec droits injectés et parcours navigateur sont des preuves différentes.
Cet audit ne lance aucun cron global et ne lit aucun message client.

## Ce que contient réellement le Business OS en brouillon

Références exactes : `docs/ajg-business-os.md`,
`docs/business-os-crm-rollout.md`, `docs/business-os-collector-integration.md`,
`src/lib/business-os/worker.ts` et `postgres-store.ts` dans le head #224 ci-dessus.

Les neuf spécialistes sont acquisition, sales, billing, fulfillment, domains,
run, finops, customer-success et growth, avec coordinateur sans permissions héritées.
Le worker candidat est OFF par défaut et n’autorise que `lead.score` et
`experiment.propose` ; il ne contacte pas de prospect, n’achète pas de domaine et
ne déploie pas. L’adaptateur PostgreSQL existe en code, mais ses tables et ses
credentials opérationnels ne sont pas prouvés par ce constat. Le plan collecteur
dit explicitement qu’aucun endpoint ni collecte production n’est ouvert.

Ne pas fusionner aveuglément les 118 fichiers divergents de cette PR ni recréer
un autre registre. Une extraction/reconciliation ciblée et une recette jetable
du worker et de l’audit sont nécessaires avant tout raccordement. Le RUN
PostgreSQL de main est un autre chantier : `docs/run-postgres-delivery.md` garde
Blob canonique, SQL dormant/quarantaine et exige drain + comparaison + rôles limités.
Son succès CI localhost ne prouve pas une migration Neon ni le pilote commercial.

## Incrément de cet audit : preuve d’exécution bêta

Le reporting business traitait comme healthy tout statut bêta autre que failed
ou attention, sans vérifier la fin/fraîcheur du journal. Un running, une date
future/invalide ou un ancien healthy pouvait donc masquer un agent arrêté.

Le classificateur exige maintenant une fin valide non future de moins de 36 h
(cadence quotidienne + 12 h de tolérance), un statut terminal connu et des
compteurs entiers cohérents. Les échecs explicitement enregistrés restent failed.
Les preuves absentes restent unavailable ; les preuves incomplètes, périmées ou
contradictoires deviennent attention avec une raison agrégée. Les relances à
préparer restent distinctes d’une absence de preuve d’exécution. Aucun replay,
nouvelle écriture, requête SQL, SDK, schéma, Auth/RLS, secret ou permission modifiés.
Ce délai est une politique d’observation, pas un SLA ni une alarme de panne prouvée.

Tests : vrai `buildBuilderBusinessReport`, vrais classificateurs, ports de lecture
et fournisseur simulés. Trois groupes de régressions rouges avant correction ;
neuf états de compteurs, statut running/inconnu, fin manquante/invalide/future,
frontière 36 h, échec persistant, absence de journal et erreur de lecture couverts.
Ce n’est ni une panne provoquée ni un nouvel appel fournisseur ou client réel.
CI exacte, publication et recettes finales sont consignées dans la PR associée.

## Ordre de travail pour atteindre l’objectif

1. **Preuve client complète** : établir une identité invitée ordinaire de recette
   et sa boîte de réception explicitement autorisées. Aucun compte existant ou
   example.invalid préconfirmé ne remplace cette preuve. Préparer le scénario
   email → navigateur → sandbox → droits → publication et son nettoyage.
2. **RUN historique** : #525 `req_5cbfea80` et #526 `req_1b09b202` restent ouvertes.
   Les issues publiques donnent ces IDs ; elles ne donnent pas les détails du
   registre privé. Le GET non authentifié du 24/10 sur `/api/run/intake` retourne
   HTTP 401 ; aucun credential n’est récupéré ni restriction contournée.
   Accès légitime indispensable avant attribution ou réparation.
   Diagnostic réussi n’est pas résolution ; aucun reset, doublon ou clôture supposée.
3. **Pilote commercial sans envoi** : reprendre #224 par tranches revues depuis
   main ; tester collecte autorisée en lecture, scoring déterministe, suppression,
   dossier de prospect, brouillon, réservation/audit atomiques et reprise incertaine
   sur PostgreSQL jetable. Aucun vrai prospect ni envoi, migration ou nouveau droit
   de production n’est permis par une simple réussite de ces tests.
4. **Activation contrôlée** : établir une identité de service limitée et la preuve
   de concurrence/reprise, vérifier les sources et la rétention, puis seulement
   proposer un raccordement étroit pour validation. Réutiliser les moteurs
   facturation/support/RUN existants plutôt qu’inventer des agents doublons.
5. **Avant ventes** : approuver l’identité légale/fiscale et contrôler la facture
   sandbox complète, la configuration live, les consentements et la campagne.
   Les flags et le pied de facture validé techniquement ne valent pas cette revue.
   Mesurer qualité, satisfaction et coûts réels avant toute promesse de marge,
   de satisfaction à 98 % ou de gestion entièrement autonome.

Les points 1, accès privé historique, identité de service/permissions et validation
commerciale sont les interventions humaines à regrouper. Le reste du code et des
recettes isolées autorisées doit continuer sans sollicitation à chaque PR.

La mission de travail jusqu’à 20 h Paris est enregistrée dans le pilote existant ;
un lancement immédiat a été accepté le 24 octobre. La récurrence permanente est
préservée. Le service n’expose pas `next_run_time` : aucune continuité ni heure de
déclenchement future n’est garantie par cette configuration.

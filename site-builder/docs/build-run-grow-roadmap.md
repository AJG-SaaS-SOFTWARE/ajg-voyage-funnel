# AJG Site Builder — Roadmap BUILD / RUN / GROW

Dernière mise à jour : 29 septembre 2026.

## 1. Vision produit

AJG Site Builder ne doit pas devenir un SaaS nécessitant un support humain quotidien.

Le produit cible un fonctionnement **self-service, automatisé, observable et économiquement contrôlé** :

> **BUILD** — créer le site rapidement, éventuellement de A à Z avec le Concepteur IA.  
> **RUN** — héberger, sécuriser, maintenir, publier et modifier le site avec un minimum d'intervention humaine.  
> **GROW** — analyser les performances, détecter les opportunités et proposer des améliorations continues pilotées par IA.

Objectif opérationnel :

- support humain exceptionnel, pas structurel ;
- aucune action répétitive qui puisse être automatisée ne doit rester manuelle ;
- toute fonction IA coûteuse doit avoir un budget, un quota, une télémétrie et un mécanisme d'arrêt ;
- tout incident courant doit être diagnostiqué automatiquement avant d'atteindre AJG ;
- les changements de contenu importants restent validés par le client avant application ;
- les changements techniques sûrs et déterministes peuvent être automatisés lorsqu'ils sont réversibles.

---

## 2. Offre commerciale cible

### Essentiel — RUN

**15 € / mois** ou **150 € / an**.

Promesse :

> Votre site professionnel reste en ligne, modifiable, sécurisé et maintenu.

Inclus :

- 1 site ;
- hébergement et publication ;
- domaine personnalisé ;
- éditeur complet ;
- responsive ;
- sauvegardes ;
- SEO technique essentiel ;
- analytics essentiels ;
- IA rédactionnelle légère ;
- Quality Check avant publication ;
- self-service domaine, facturation, export et récupération.

Non inclus :

- pilotage Growth continu ;
- audit stratégique IA récurrent ;
- recommandations avancées de conversion ;
- optimisation SEO/AEO continue ;
- nouvelles architectures/pages pilotées par l'AI Website Manager.

### Création IA complète — BUILD

**49 € une fois**.

Promesse :

> Décrivez votre activité. AJG conçoit une première version complète et publiable de votre site.

La prestation automatisée comprend :

- diagnostic du besoin ;
- stratégie ;
- architecture ;
- pages ;
- direction visuelle ;
- premiers textes ;
- CTA ;
- FAQ / bénéfices lorsque pertinents ;
- utilisation des contenus autorisés ;
- audits qualité ;
- raffinement automatique si nécessaire ;
- proposition modifiable avant publication.

Le paiement de 49 € achète une **prestation de création initiale**, pas un abonnement.

### Growth — RUN + GROW

**29 € / mois** ou **290 € / an**.

Promesse :

> Votre site est analysé et amélioré en continu pour rester utile à votre activité.

Inclus :

- tout Essentiel ;
- AI Website Manager ;
- diagnostics de performance ;
- recommandations SEO/AEO ;
- recommandations conversion / CTA ;
- détection d'erreurs et d'opportunités ;
- création assistée de nouvelles pages / campagnes ;
- adaptation globale du site à une nouvelle offre ou cible ;
- capacité IA supérieure ;
- synthèses et actions prioritaires.

Hypothèse commerciale retenue :

- Création IA : +49 € en Essentiel mensuel/annuel ;
- Création IA : +49 € en Growth mensuel ;
- Création IA offerte avec Growth annuel à 290 €.

Cette gratuité annuelle ne doit être activée qu’une fois le coût réel moyen du Concepteur IA mesuré sur la bêta. Le gate serveur `AJG_GROWTH_ANNUAL_INCLUDES_AI_LAUNCH` est désactivé par défaut ; tant qu’il reste désactivé, Growth annuel n’accorde pas de droit BUILD gratuit.

---

## 3. Principes d'architecture économique

### 3.1 Chaque coût variable doit être attribuable

Chaque appel IA doit enregistrer :

- utilisateur ;
- site ;
- plan ;
- opération ;
- modèle ;
- tokens entrée/cache/sortie/raisonnement ;
- durée ;
- résultat succès/échec ;
- coût estimé ;
- éventuel remboursement de quota.

Chaque autre coût variable significatif doit être rapprochable d'un site ou d'un compte lorsque possible :

- stockage ;
- egress ;
- sauvegardes ;
- médias ;
- domaine ;
- emails ;
- jobs planifiés ;
- erreurs/retries.

### 3.2 Aucun appel Premium sans justification

Politique de routage :

1. règles déterministes ;
2. logique serveur locale ;
3. modèle rapide/économique ;
4. modèle Premium seulement si la qualité ou la complexité l'exige.

Le modèle Premium ne doit pas être utilisé pour :

- vérifier un lien ;
- compter une longueur ;
- détecter un champ vide ;
- tester un statut DNS ;
- vérifier une erreur HTTP ;
- calculer une métrique ;
- répéter une analyse déjà valable.

### 3.3 Quotas intelligents, pas "IA illimitée"

Chaque plan possède :

- limite par minute ;
- limite journalière ;
- budget mensuel ;
- plafond spécifique aux opérations lourdes ;
- protection contre les rafales ;
- circuit breaker global AJG ;
- seuil d'alerte coût par compte.

Les opérations légères et lourdes sont séparées.

Exemples :

- réécriture d'un champ = légère ;
- audit d'une page = moyenne ;
- création complète / refonte = lourde.

### 3.4 Budget coût avant appel

Avant une opération lourde :

- estimer sa classe de coût ;
- vérifier entitlement ;
- vérifier quota ;
- réserver le budget ;
- exécuter ;
- rembourser automatiquement si échec avant résultat exploitable.

### 3.5 Protection contre les abus

À prévoir côté serveur :

- rate limiting ;
- idempotency keys ;
- déduplication des requêtes ;
- cooldown sur régénérations complètes ;
- blocage des boucles de retry ;
- détection de patterns anormaux ;
- quotas par site et par utilisateur ;
- suspension automatique d'une fonction coûteuse en cas d'anomalie ;
- journal d'audit administrateur ;
- aucun contrôle critique uniquement dans l'UI.

---

# 4. Roadmap produit

## Phase 0 — Rebaser l'offre et les entitlements

Objectif : que tout le produit raisonne en BUILD / RUN / GROW.

### À faire

- [x] remplacer les prix publics 19/39 par 15/29 ;
- [x] renommer Pro IA en **Growth** ;
- [x] introduire un entitlement séparé **AI Launch / Création IA** ;
- [x] ne plus lier l'accès au Concepteur IA uniquement au plan mensuel ;
- [x] créer un achat ponctuel de 49 € donnant droit à une création initiale ;
- [x] définir précisément ce que consomme une "Création IA" : 4 opérations BUILD complètes réussies par défaut, réservées avant exécution et remboursées si échec ;
- [x] prévoir création offerte pour Growth annuel, accordée uniquement après abonnement Stripe actif ;
- [x] adapter Supabase : plan + droits + achat ponctuel ;
- [x] adapter Stripe sandbox : Essentiel 15/150, Growth 29/290, Création IA 49 ;
- [x] adapter Checkout, webhook et Customer Portal ;
- [x] conserver Beta Tester avec accès complet hors Stripe.

### Définition de terminé

Un compte peut être :

- Essentiel sans Création IA ;
- Essentiel + Création IA achetée ;
- Growth mensuel ;
- Growth annuel avec Création IA offerte uniquement lorsque le gate de rentabilité est activé ;
- Beta Tester.

Aucun droit n'est déduit uniquement du front-end.

**Garde-fous Phase 0 déjà actifs :**
- Création IA : 4 opérations lourdes réussies par droit BUILD par défaut, valeur interne configurable de 1 à 20 ;
- Growth : 12 opérations lourdes globales par mois au démarrage, séparées des quotas d'IA légère ;
- Beta Tester : 30 opérations lourdes par mois afin d'observer l'usage sans permettre une consommation non bornée ;
- réservation idempotente avant génération et remboursement automatique si la génération échoue ;
- atteinte du plafond lourd : seules les opérations lourdes sont bloquées, le site et l'IA légère restent disponibles.

---

## Phase 1 — FinOps IA et garde-fous de coûts

Objectif : connaître et maîtriser le coût de chaque utilisateur avant de déployer Growth.

### À faire

- [ ] compléter la télémétrie AI Provider déjà présente ;
- [ ] calculer le coût estimé en euros par appel ;
- [ ] dashboard coût par :
  - site ;
  - utilisateur ;
  - plan ;
  - opération ;
  - modèle ;
  - jour / mois ;
- [ ] coût réel moyen d'une Création IA ;
- [ ] coût réel moyen d'un client Essentiel ;
- [ ] coût réel moyen d'un client Growth ;
- [ ] budgets serveur par opération ;
- [ ] quotas distincts léger / moyen / lourd ;
- [ ] alerte à 50 / 75 / 90 / 100 % du budget ;
- [ ] circuit breaker individuel ;
- [ ] circuit breaker global AJG ;
- [ ] détection d'usage anormal ;
- [ ] optimisation cache / réutilisation de stratégie ;
- [ ] modèle Premium uniquement lorsque nécessaire ;
- [ ] limitation des retries et régénérations intégrales ;
- [ ] fallback gracieux vers fonctions non IA si budget atteint.

### KPI de sortie

Avant lancement commercial :

- coût médian Création IA connu ;
- P95 du coût Création IA connu ;
- coût moyen IA/client/mois connu ;
- aucun utilisateur ne peut créer un coût non borné ;
- capacité à couper une opération coûteuse sans couper le site.

---

## Phase 2 — Onboarding self-service zéro assistance

Objectif : un client doit pouvoir passer de zéro à site publié sans intervention AJG.

### Parcours cible

1. création de compte ;
2. choix du plan ;
3. choix :
   - je crée moi-même ;
   - l'IA crée mon site ;
4. brief ;
5. génération ;
6. validation ;
7. personnalisation ;
8. domaine ;
9. publication ;
10. diagnostic final.

### À faire

- [ ] onboarding adaptatif selon plan ;
- [ ] progression visible ;
- [ ] reprise automatique après interruption ;
- [ ] autosave à chaque étape ;
- [ ] détection des données manquantes ;
- [ ] aide contextuelle ;
- [ ] exemples uniquement lorsque nécessaires ;
- [ ] diagnostic pré-publication ;
- [ ] correction guidée en un clic ;
- [ ] self-service domaine avec statut DNS clair ;
- [ ] self-service facturation ;
- [ ] self-service export ;
- [ ] self-service suppression ;
- [ ] messages d'erreur exploitables, jamais "une erreur est survenue" sans prochaine action.

### KPI de sortie

- majorité des testeurs publient sans aide ;
- temps humain AJG médian par activation proche de 0 ;
- chaque abandon du funnel est mesurable.

---

## Phase 3 — Centre de diagnostic automatique

Objectif : avant de contacter AJG, le produit doit savoir expliquer ce qui ne fonctionne pas.

### Health Center client

Chaque site dispose d'un statut :

- **Sain** ;
- **À corriger** ;
- **Action requise** ;
- **Incident externe**.

### Contrôles automatiques

- [ ] publication ;
- [ ] domaine / DNS ;
- [ ] HTTPS ;
- [ ] formulaire ;
- [ ] liens cassés ;
- [ ] images manquantes ;
- [ ] erreurs de rendu ;
- [ ] stockage ;
- [ ] quota IA ;
- [ ] paiement ;
- [ ] sauvegarde ;
- [ ] SEO essentiel ;
- [ ] sitemap / canonical ;
- [ ] latence anormale ;
- [ ] erreurs runtime récentes.

### Auto-remédiation

Automatiser uniquement les actions sûres et réversibles :

- retry d'un job ;
- régénération d'un cache ;
- reprise d'une notification ;
- republication technique sans changement éditorial ;
- réparation d'un état incohérent déterministe.

Validation client obligatoire pour :

- changement de texte ;
- changement de CTA ;
- suppression d'une page ;
- modification d'une offre ;
- changement graphique important.

### KPI de sortie

- au moins 80 % des incidents courants disposent d'un diagnostic automatique ;
- chaque diagnostic propose une action ;
- les tickets humains sont catégorisés pour automatiser les causes répétitives.

---

## Phase 4 — Support self-service

Objectif : le support humain devient l'exception.

### À faire

- [ ] assistant support contextuel ayant accès uniquement aux diagnostics autorisés ;
- [ ] base de connaissances FR/EN ;
- [ ] aide liée à l'écran courant ;
- [ ] explication automatique des erreurs ;
- [ ] bouton "Diagnostiquer mon site" ;
- [ ] bouton "Corriger automatiquement" lorsque sûr ;
- [ ] parcours guidé domaine ;
- [ ] parcours guidé facturation ;
- [ ] parcours guidé récupération de site ;
- [ ] parcours guidé changement de formule ;
- [ ] collecte structurée du motif avant toute demande humaine.

### Escalade humaine uniquement pour

- bug non reproductible automatiquement ;
- incident de sécurité ;
- litige paiement ;
- cas juridique ;
- corruption de données ;
- demande commerciale particulière ;
- incident fournisseur prolongé.

### KPI de sortie

- < 0,15 demande humaine / client / mois comme objectif initial ;
- > 80 % des demandes résolues sans AJG ;
- causes récurrentes transformées en automatisation produit.

---

## Phase 5 — Analytics first-party utiles

Objectif : créer la base de Growth sans devenir Google Analytics.

### Mesurer

- visites ;
- pages vues ;
- sources principales ;
- CTA vus ;
- CTA cliqués ;
- formulaire démarré ;
- formulaire envoyé ;
- pages d'entrée ;
- pages de sortie ;
- événements utiles définis par le site.

### Principes

- privacy-by-design ;
- pas de collecte inutile ;
- faible coût ;
- agrégation ;
- rétention bornée ;
- aucune donnée brute envoyée à un LLM si un calcul déterministe suffit.

### Restitution

Essentiel :

- métriques simples ;
- tendances ;
- alertes techniques.

Growth :

- interprétation ;
- priorisation ;
- recommandations.

---

## Phase 6 — AI Website Manager / Growth

Objectif : justifier chaque mois les 14 € de différence entre Essentiel et Growth.

### Boucle Growth

**Observer → détecter → prioriser → proposer → faire valider → appliquer → mesurer**

### Niveau 1 — Health

- [ ] site cassé / sain ;
- [ ] SEO technique ;
- [ ] contenus incomplets ;
- [ ] liens ;
- [ ] performance ;
- [ ] domaine ;
- [ ] formulaire.

Très peu d'IA Premium.

### Niveau 2 — Opportunities

- [ ] pages peu consultées ;
- [ ] CTA peu utilisés ;
- [ ] trafic sans conversion ;
- [ ] contenu vieillissant ;
- [ ] nouvelles pages utiles ;
- [ ] maillage interne ;
- [ ] SEO/AEO ;
- [ ] proposition de FAQ ;
- [ ] opportunités de landing pages.

### Niveau 3 — Recommendations

Chaque recommandation doit contenir :

- problème détecté ;
- preuve / signal ;
- impact potentiel ;
- proposition ;
- coût estimé de l'action ;
- bouton appliquer / ignorer.

### Niveau 4 — Execution

Le client peut demander :

- créer une nouvelle page ;
- lancer une offre ;
- adapter le site à une nouvelle cible ;
- refaire un CTA ;
- proposer une landing page ;
- améliorer une page faible.

Les changements sont prévisualisés avant application.

### KPI de sortie

Growth doit générer mensuellement au moins un des résultats suivants pour une part significative des comptes actifs :

- anomalie détectée ;
- amélioration pertinente ;
- nouvelle opportunité ;
- nouvelle page ;
- recommandation appliquée.

Un compte sans activité ne doit pas déclencher artificiellement des analyses IA coûteuses.

---

## Phase 7 — Diagnostic Growth efficient

Objectif : ne jamais scanner tous les sites au modèle Premium "par principe".

### Architecture événementielle

Déclencheurs possibles :

- variation significative des visites ;
- nouvelle page ;
- nouvelle offre ;
- formulaire qui chute ;
- lien cassé ;
- page non visitée ;
- changement SEO ;
- expiration d'un contenu ;
- problème technique ;
- demande du client.

### Pipeline

1. métriques locales ;
2. règles déterministes ;
3. score d'opportunité ;
4. si score suffisant : analyse IA légère ;
5. modèle Premium uniquement si décision complexe ;
6. recommandation ;
7. validation client.

### Budget

Chaque audit Growth doit avoir :

- coût maximal ;
- fréquence maximale ;
- seuil de déclenchement ;
- cooldown ;
- déduplication ;
- cache.

---

## Phase 8 — Autonomie opérationnelle AJG

Objectif : AJG ne doit pas "surveiller à la main".

### Cockpit automatique

Le Cockpit AJG doit afficher uniquement les exceptions :

- paiement bloqué ;
- coût IA anormal ;
- sauvegarde trop ancienne ;
- domaine cassé ;
- hausse d'erreurs ;
- job bloqué ;
- utilisateur potentiellement abusif ;
- marge d'un plan dégradée ;
- fournisseur indisponible.

### Notifications

Pas de bruit.

Règle :

> si le système peut corriger seul, il corrige et journalise ;  
> s'il ne peut pas corriger, il alerte avec diagnostic + action proposée.

### SLO opérationnels

À définir et monitorer :

- uptime ;
- succès publication ;
- succès génération ;
- temps génération ;
- erreurs domaine ;
- sauvegardes ;
- jobs ;
- coût/client ;
- support/client.

---

# 5. Budgets et limites recommandés avant données réelles

Ces valeurs sont des **garde-fous de départ**, pas des promesses commerciales publiques.

## Essentiel

Objectif interne :

- IA standard à faible coût ;
- pas de génération complète récurrente ;
- budget IA mensuel cible très inférieur à 1 € pour l'utilisateur médian ;
- stockage et trafic sous limites raisonnables.

## Création IA 49 €

Objectif interne :

- budget IA cible < 3 € ;
- seuil d'alerte interne à 5 € ;
- blocage/révision du pipeline si P95 dépasse durablement ce niveau ;
- nombre de régénérations complètes borné ;
- réutilisation de stratégie lorsque possible.

## Growth 29 €

Objectif interne :

- budget IA médian cible < 3 € / mois ;
- P95 < 6 € / mois ;
- analyses lourdes déclenchées par signal ;
- audit complet non systématique si aucune évolution ;
- quota séparé pour refontes lourdes.

## Infrastructure

Suivre par cohorte :

- stockage moyen/site ;
- egress moyen/site ;
- fonctions serveur ;
- Blob ;
- emails ;
- coûts domaine éventuels ;
- coûts provider.

---

# 6. Anti-abus

## IA

- rate limit ;
- burst limit ;
- cooldown ;
- coût max par requête ;
- coût max quotidien ;
- coût max mensuel ;
- nombre max de créations complètes ;
- idempotence ;
- déduplication ;
- suspension ciblée de l'IA sans couper le site.

## Média

- limites MIME ;
- limite taille fichier ;
- limite stockage ;
- compression ;
- refus des formats inutiles ;
- nettoyage des objets orphelins ;
- quotas par plan.

## Trafic / formulaires

- protection bot ;
- rate limiting ;
- CAPTCHA adaptatif seulement en cas de risque ;
- limite de taille ;
- détection spam ;
- blocage IP/empreinte uniquement lorsque justifié.

## Paiement

- entitlement serveur ;
- webhook signé ;
- idempotence ;
- aucun accès payant débloqué par le client ;
- politique impayés déjà existante ;
- fonctions coûteuses coupées en priorité.

---

# 7. Mesures de rentabilité à suivre

Le dashboard commercial doit suivre :

- MRR ;
- ARR ;
- ARPU ;
- répartition Essentiel / Growth ;
- taux d'achat Création IA ;
- conversion mensuel → annuel ;
- churn ;
- coût Stripe ;
- coût IA ;
- coût infra ;
- coût email ;
- coût moyen total par client ;
- marge contributive ;
- support humain/client ;
- coût d'acquisition lorsque disponible.

## Alarmes économiques

Déclencher une alerte si :

- IA > 15 % du revenu mensuel d'un compte ;
- infra variable > 15 % ;
- coût direct total > 35 % ;
- support humain dépasse le seuil défini ;
- un utilisateur dépasse significativement sa cohorte.

Ces seuils sont des garde-fous internes à affiner avec les données réelles.

---

# 8. Ordre de développement recommandé

## Priorité P0 — avant toute ouverture commerciale

1. rebaser prix et entitlements 15 / 29 / 49 ;
2. instrumenter coûts IA réels ;
3. quotas et circuit breakers ;
4. achat ponctuel Création IA ;
5. onboarding self-service ;
6. Health Center technique ;
7. erreurs/actionnabilité ;
8. parcours domaine + facturation self-service ;
9. bêta réelle 5–10 utilisateurs ;
10. mesurer coût et besoin de support.

## Priorité P1 — pour lancer Growth

11. analytics first-party ;
12. moteur de signaux ;
13. score d'opportunité ;
14. audits Growth déclenchés intelligemment ;
15. recommandations ;
16. prévisualisation + application ;
17. synthèse mensuelle.

## Priorité P2 — pour réduire le run humain

18. assistant support contextuel ;
19. auto-remédiation technique ;
20. détection anomalies coûts ;
21. Cockpit exceptions-only ;
22. automatisation des incidents répétitifs.

## Priorité P3 — optimisation

23. SEO/AEO avancé ;
24. A/B testing ;
25. optimisation conversion ;
26. modèles prédictifs légers ;
27. extensions payantes éventuelles stockage / trafic / IA.

---

# 9. Critères de commercialisation

AJG Site Builder n'est commercialisable à grande échelle que lorsque :

- [ ] un client peut s'inscrire sans aide ;
- [ ] un client peut payer sans aide ;
- [ ] un client peut créer/publier sans aide ;
- [ ] un client peut configurer son domaine sans aide AJG dans la majorité des cas ;
- [ ] les erreurs principales sont auto-diagnostiquées ;
- [ ] les opérations coûteuses sont bornées ;
- [ ] le coût IA par client est visible ;
- [ ] le coût de Création IA est mesuré ;
- [ ] le support humain médian est proche de zéro ;
- [ ] sauvegarde / impayés / export / suppression fonctionnent ;
- [ ] aucun changement Growth important n'est appliqué sans validation ;
- [ ] Checkout live reste impossible tant que les gates juridique et fiscal ne sont pas validés.

---

# 10. Règle de décision produit

Toute nouvelle fonctionnalité doit répondre à au moins une de ces questions :

1. augmente-t-elle le taux de publication ?
2. réduit-elle le temps nécessaire au client ?
3. améliore-t-elle le résultat du site ?
4. réduit-elle le support humain ?
5. réduit-elle le coût de run ?
6. augmente-t-elle la rétention Growth ?
7. réduit-elle un risque sécurité / abus / conformité ?

Si la réponse est non partout, elle n'est pas prioritaire.

# ELTARA — Roadmap BUILD / RUN / GROW

Dernière mise à jour : 30 septembre 2026.

## 1. Vision produit

ELTARA ne doit pas devenir un SaaS nécessitant un support humain quotidien.

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

- [x] compléter la télémétrie AI Provider : coûts USD versionnés, modèle demandé, requête complète, plan et source ;
- [ ] calculer le coût estimé en euros par appel ;
- [x] dashboard coût par :
  - site ;
  - utilisateur ;
  - plan ;
  - opération ;
  - modèle ;
  - jour / mois ;
- [ ] coût réel moyen d'une Création IA ;
- [ ] coût réel moyen d'un client Essentiel ;
- [ ] coût réel moyen d'un client Growth ;
- [x] budgets serveur par opération ;
- [ ] quotas distincts léger / moyen / lourd ;
- [x] alerte à 50 / 75 / 90 / 100 % du budget : vue admin + registre planifié, sans notifications externes ;
- [x] circuit breaker individuel : plafonds atomiques compte/site/BUILD ;
- [x] circuit breaker global AJG ;
- [x] détection d'usage anormal : comparaison déterministe de la dernière heure aux 7 jours précédents, seuils minimums anti-faux-positifs, signal warning/critical sans modification automatique des quotas ;
- [ ] optimisation cache / réutilisation de stratégie ;
- [x] modèle Premium uniquement lorsque nécessaire : champs simples refusent un modèle Premium ;
- [x] limitation des retries et régénérations intégrales : admission, idempotence, déduplication et cooldown ;
- [x] fallback gracieux vers l’édition manuelle si budget atteint, sans couper le site.

### État vérifié au 30 septembre 2026

Les PR #159 à #165 couvrent la télémétrie, les budgets monétaires, les remboursements de capacité sans effacement du coût fournisseur, la déduplication, le rapport mensuel, la conservation des résumés financiers et la surveillance planifiée. La vue est `/admin/finops`. Les valeurs sont des estimations USD ; les statistiques BUILD regroupent tous les appels d’une génération et suivent aussi le coût cumulé du droit acheté. Les garde-fous couvrent chaque appel, y compris réparations et revues internes.

Il n’y a encore aucun appel fournisseur dans la télémétrie réelle : les moyennes/médianes/P95 de sortie ne sont **pas validées** par les fixtures techniques. Conversion EUR datée, rapprochement des revenus/factures, alertes de marge et optimisation empirique restent à terminer. La gratuité BUILD de Growth annuel reste désactivée par défaut, en attente de données bêta.

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

- [x] onboarding adaptatif selon plan ;
- [x] progression visible ;
- [x] reprise automatique après interruption ;
- [x] autosave à chaque étape ;
- [x] détection des données manquantes ;
- [x] aide contextuelle ;
- [x] exemples uniquement lorsque nécessaires ;
- [x] diagnostic pré-publication ;
- [x] correction guidée en un clic ;
- [x] self-service domaine avec statut DNS clair ;
- [x] self-service facturation ;
- [x] self-service export ;
- [x] self-service suppression ;
- [x] messages d'erreur exploitables sur les parcours client critiques : IA, sauvegarde, publication, médias et domaines proposent désormais une prochaine action au lieu d’un fallback générique.

### État d’implémentation

Le tableau de bord calcule une progression déterministe sur les étapes essentielles (identité, message, informations légales, publication), renvoie directement vers la première étape incomplète et réutilise le brouillon distant/autosave existant. Le Builder dispose déjà d’une aide contextuelle par étape, d’exemples ciblés, d’un Quality Check pré-publication et de liens « Corriger » vers les étapes concernées. Après publication cloud, un diagnostic final Health Center est désormais lancé sans bloquer la publication et peut être relancé manuellement. Tant que le contenu principal n’est pas engagé, le choix du parcours dépend des droits serveur : le bouton « Créer avec l’IA » n’est proposé que lorsque le droit BUILD du site est actif ; sinon le parcours manuel reste immédiatement disponible et l’offre Création IA est présentée séparément.

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

- [x] publication ;
- [x] domaine / DNS ;
- [x] HTTPS ;
- [x] formulaire natif : soumission publique FR/EN, validation serveur, consentement, anti-abus pseudonymisé, stockage Supabase et notification e-mail best-effort ;
- [x] liens configurés invalides (format HTTPS) ;
- [x] liens externes devenus inaccessibles après publication : contrôle actif borné, timeout court, redirections limitées et garde SSRF contre les destinations locales/privées ;
- [x] images manquantes dans les modules/médias explicitement activés ;
- [x] erreurs de rendu ;
- [x] stockage ;
- [x] quota IA : diagnostic serveur des fenêtres minute/jour/mois selon l’offre effective, détection quota atteint/proche et prise en compte du quota Growth lourd ;
- [x] paiement ;
- [x] sauvegarde ;
- [x] SEO essentiel ;
- [x] sitemap / canonical ;
- [x] latence anormale ;
- [x] erreurs runtime récentes : signal Vercel borné sur la production courante, fenêtre d’une heure, comptage erreurs/fatals/5xx sans exposer le contenu des logs.

### État d’implémentation

La boîte de réception client permet désormais de lire et supprimer les messages de contact stockés par site, sans dépendre de Resend. Les notifications e-mail restent un canal complémentaire lorsqu’elles sont configurées.

Le Health Center vérifie déjà le backend, l’état de publication, le rendu public HTTPS, le domaine/DNS, la facturation, les sauvegardes, les garde-fous IA, la canonical, le sitemap et la latence. Le module Contact public est désormais branché sur le RPC sécurisé existant : formulaire natif, consentement explicite, validation serveur, fingerprint pseudonymisé, rate limit et conservation dans `contact_messages`; une notification Resend est envoyée lorsque le service e-mail est configuré. Il contrôle désormais aussi de façon déterministe le module Contact, les galeries/médias publiables, le format des liens configurés et la disponibilité des buckets `site-media` / `site-private-media`. Ces contrôles n’envoient aucun contenu client à un LLM et ne suivent pas les liens externes arbitraires.

Le back-office Support expose également l’état de santé de l’infrastructure ELTARA : URL applicative de secours, domaine public et canari du wildcard de publication. Une panne DNS externe est distinguée d’une panne applicative afin de conserver l’accès administrateur et d’orienter immédiatement l’action vers le bon fournisseur.

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

- [x] assistant support contextuel déterministe : utilise uniquement les clés/statuts du Health Center autorisés, sans transmettre le contenu du site ou du ticket à un LLM ;
- [x] base de connaissances FR/EN : domaines/DNS, facturation, publication, quotas IA et export de données, avec liens directs vers les parcours ELTARA ;
- [ ] aide liée à l'écran courant ;
- [ ] explication automatique des erreurs ;
- [x] bouton "Diagnostiquer mon site" : relance explicite des contrôles Health Center sans créer de ticket ;
- [x] bouton "Corriger automatiquement" lorsque sûr : remédiation allowlistée et auditée du sous-domaine géré ;
- [x] parcours guidé domaine : sous-domaine géré, ajout du domaine personnel, vérification DNS et garde-fou explicite contre la modification d’enregistrements non demandés ;
- [x] parcours guidé facturation : état lisible, conséquences, régularisation Stripe et priorité à l’export selon la phase d’impayé ;
- [ ] parcours guidé récupération de site ;
- [x] parcours guidé changement de formule : Checkout pour un premier abonnement, portail Stripe pour un abonnement existant, avec garde-fou backend anti-double abonnement ;
- [x] collecte structurée du motif avant toute demande humaine : catégorie, sujet, contexte utilisateur et diagnostic technique sont attachés avant escalade.

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

ELTARA n'est commercialisable à grande échelle que lorsque :

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

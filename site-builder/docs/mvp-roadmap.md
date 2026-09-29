# Roadmap MVP — AJG Site Builder

Dernière mise à jour : 29 septembre 2026.

## Sprint 1 — configurateur utilisable
État : terminé pour le prototype bêta

- [x] application Next.js isolée ;
- [x] parcours guidé ;
- [x] aperçu en direct ;
- [x] validation des champs essentiels ;
- [x] sauvegarde locale automatique des modifications ;
- [x] sauvegarde distante Supabase et brouillons privés ;
- [x] upload réel de photo de profil ;
- [x] publication partageable ;
- [x] personnalisation des couleurs, fonds, motifs, image et son ;
- [x] photo personnelle en arrière-plan, compression WebP, rendu `cover` et point focal intelligent ajustable ;
- [x] contraste automatique texte/fond et contraste du CTA ;
- [x] profil MWR ou activité indépendante, logos facultatifs ;
- [x] conformité centralisée et verrouillée ;
- [x] base FR / EN.

## Sprint 2 — Supabase
État : socle opérationnel

- [x] projet Supabase dédié ;
- [x] Auth email / Magic Link ;
- [x] tables sites, media, travel_journals et domains ;
- [x] RLS et relations principales ;
- [x] isolation des brouillons par propriétaire ;
- [x] Storage pour les médias ;
- [x] repository Supabase côté application ;
- [x] quotas d'utilisation de l'assistant IA côté base ;
- [x] contrôle sécurité Supabase sans alerte active.

## Sprint 3 — publication multi-tenant
État : largement opérationnel

- [x] résolution du site par hostname ;
- [x] sous-domaines gérés ;
- [x] rendu public SSR ;
- [x] métadonnées SEO et canonical ;
- [x] statuts brouillon / publié / suspendu côté données ;
- [x] page introuvable pour un site non publié ;
- [x] sitemap par site ;
- [x] sous-domaine canari réel rattaché à Vercel, CNAME externe propagé, `verified + primary` en base et activation conditionnée à une configuration DNS exploitable ; contrôle HTTPS automatique ajouté au diagnostic/release ;
- [x] domaine personnalisé en option côté produit, droits, données et routage ; automatisation DNS/Vercel encore externe.

## Sprint 4 — onboarding, IA et qualité bêta
État : développement produit terminé ; observation bêta réelle à poursuivre après déploiement

- [x] questionnaire guidé 3+1 pour préparer les textes ;
- [x] transformation de réponses courtes ou mots-clés en textes structurés ;
- [x] assistant IA dans les champs éditoriaux ;
- [x] actions rapides Améliorer / Plus naturel / Plus chaleureux / Plus professionnel / Plus court / Nouvelle proposition ;
- [x] validation humaine avant tout remplacement de texte ;
- [x] Quality Check avant publication ;
- [x] relecture IA orthographe, grammaire, cohérence, répétitions, clarté marketing et CTA ;
- [x] contrôles liens HTTPS, champs incomplets, modules, contraste, longueurs mobile, cadrage et légendes d'images ;
- [ ] création et observation de plusieurs sites bêta réels ;
- [x] instrumentation first-party minimale du funnel builder : ouverture, étapes clés, application IA et publication, sans contenu utilisateur dans les événements ;
- [x] journal structuré de retours utilisateur avec catégorie, note et message volontaire ;
- [x] back-office préparé pour suivre les métriques bêta et les retours ;
- [ ] amélioration continue du template public sur la base des tests réels.

## Itération 4A — AI Site Architect, architecture et contenus utilisateur
État : terminé côté code sur `main` ; recette E2E production validée

Objectif de sortie : l’IA peut proposer une structure de site sensiblement différente du template historique, sans publier ni inventer silencieusement des informations sensibles.

- [x] proposition complète distincte de l’assistant champ par champ ;
- [x] choix IA d’une famille de layout, composition du hero et largeur éditoriale ;
- [x] choix IA monopage ou multipage et plan de 1 à 6 pages ;
- [x] pages publiques routées et navigation multipage ;
- [x] métadonnées propres aux sous-pages et sitemap par site ;
- [x] ordre des modules et modules facultatifs conservés ;
- [x] bibliothèque de contenus utilisateur : texte, image/photo, audio/musique, document ;
- [x] provenance/droits explicites : propriétaire, licence, domaine public compatible ou inconnu ;
- [x] contenu aux droits inconnus bloqué par défaut pour la publication ;
- [x] AI Site Architect alimenté par les contenus déclarés publiables ;
- [x] Quality Check : cohérence architecture, contenus publiables incomplets et droits inconnus ;
- [x] validation humaine avant application de la proposition ;
- [x] édition manuelle conservée après application ;
- [x] upload direct multi-format depuis la bibliothèque : images, audio, PDF et TXT, avec taille/type bornés ;
- [x] attribution automatique par l’IA des assets autorisés aux pages, validation des IDs et rendu public ;
- [x] conversation de révision globale du site (« plus premium », « retire cette page », etc.) avec proposition séparée et validation avant application ;
- [x] révision Premium à portée minimale : le site courant sert de baseline, les choix non visés doivent être préservés et l’aperçu liste les zones réellement modifiées avant application ;
- [x] éditeur visuel de l’arborescence après génération : ordre, activation, suppression, ajout, type, URL, rôle et contenus affectés ;
- [x] limite de 6 pages alignée entre IA, normalisation et éditeur ; accueil unique et non déplaçable ;
- [x] IDs de contenus publiables transmis à l’AI Site Architect afin que l’affectation d’assets soit réellement exploitable.

Checkpoint de l’itération : le modèle de données, le moteur IA, la persistance, le rendu multipage et les garde-fous de droits sont reliés de bout en bout. La révision globale, l’éditeur visuel et la recette E2E de production sont validés.

### Itération 4B — contrôle humain avancé du site Premium
État : terminé côté code sur `main` ; recette E2E production validée

- [x] import direct de contenus utilisateur dans la bibliothèque ;
- [x] affectation IA des contenus autorisés aux pages ;
- [x] blocage des références vers des assets non autorisés avant publication ;
- [x] rendu public des images, textes, audios et documents affectés ;
- [x] conversation de révision globale avec aperçu structuré avant application ;
- [x] éditeur visuel d’arborescence et réaffectation manuelle des contenus.

### Itération 4D — AI Site Architect Premium v2
État : développement en cours

Objectif : transformer la génération complète en véritable prestation de stratégie web automatisée, sans sacrifier le contrôle humain ni la factualité.

- [x] modèle Premium distinct du modèle rapide des assistants champ par champ ;
- [x] étape 1 : diagnostic stratégique du besoin, du public, de l’objectif, du positionnement et du parcours visiteur ;
- [x] étape 2 : génération structurée des textes, architecture, ordre de modules et direction visuelle à partir de cette stratégie ;
- [x] Structured Outputs JSON Schema pour fiabiliser la forme des réponses Premium ;
- [x] étape 3 : audit critique indépendant de la stratégie, du copywriting, de la conversion, de la crédibilité, du design et de la conformité ;
- [x] raffinement automatique par le modèle Premium lorsqu’un problème majeur ou une qualité insuffisante est détecté ;
- [x] quality gate final : toute proposition raffinée est relue une seconde fois par un critique IA indépendant ; elle n’est pas affichée si un problème majeur subsiste ou si le seuil qualité final n’est pas atteint ;
- [x] contrôle déterministe complémentaire : placeholders, duplications de contenus/FAQ, pages redondantes et modules recommandés sans contenu déclenchent un raffinement ou bloquent l’affichage si le défaut subsiste ;
- [x] grounding quantitatif : pourcentages, prix, durées, années et quantités sensibles générés doivent réutiliser un nombre déjà présent dans le contexte client ; tout chiffre inédit déclenche un raffinement puis bloque l’affichage s’il subsiste ;
- [x] le score et les signaux d’évaluation utilisateur portent sur la version finale réellement affichée, pas seulement sur le premier brouillon ;
- [x] aucune information factuelle manquante inventée : les manques sont explicitement remontés à l’utilisateur ;
- [x] recommandations de modules appliquées uniquement lorsqu’un contenu réellement exploitable existe ;
- [x] ordre des modules proposé par l’IA et conservé à l’application ;
- [x] interface Premium enrichie : besoin compris, audience, objectif, positionnement, parcours visiteur, rationales architecture/design et audit ;
- [x] boucle de clarification conversationnelle : les informations réellement manquantes sont formulées comme questions ciblées, le client répond uniquement à ce qu’il connaît puis l’IA reconstruit et réaudite la proposition ;
- [x] les réponses de clarification complètent le brief sans transformer une information absente en supposition ;
- [x] E2E renforcée pour exiger la stratégie, l’audit Premium et le passage du quality gate final ;
- [x] instrumentation dédiée sans contenu client : première génération, régénération, raffinement automatique et application ;
- [x] dashboard admin qualité Premium : adoption utilisateurs, taux de régénération, taux de raffinement et applications/tentatives sur 30 jours ;
- [x] télémétrie fournisseur server-only : modèle, appels, tokens d’entrée/cache/sortie/raisonnement et durée, sans prompt ni contenu client ;
- [x] empreinte technique Premium visible dans l’admin pour dimensionner les futurs quotas/prix sur les coûts réels plutôt que sur une hypothèse ;
- [x] évaluation humaine structurée directement sur chaque proposition : pertinent / à améliorer, avec motif catégorisé mais aucun commentaire libre ni contenu client ;
- [x] dashboard admin enrichi avec taux positif, taux de réponse et motifs principaux des propositions jugées à améliorer ;
- [ ] valider une génération Premium v2 réelle en production après CI/release ;
- [ ] mesurer pendant la bêta le taux proposition → application et les demandes de régénération pour piloter les prochaines améliorations.

## Modules de contenu

Disponibles et facultatifs :

1. Galerie / voyages avec photos personnelles et légendes.
2. FAQ.
3. Témoignages avec attribution.
4. Contact par e-mail.
5. Vidéo YouTube.
6. Chiffres clés.
7. Avantages.

L'utilisateur peut activer ou masquer chaque rubrique et modifier l'ordre d'affichage. Une rubrique incomplète est signalée par le Quality Check et n'affiche que son contenu publiable.

Modules à étudier après validation bêta :

- carnets de voyage avec pages individuelles ;
- formulaire de contact protégé contre les abus ;
- blocs supplémentaires déterminés par les retours utilisateurs.

## Itération 4C — durcissement bêta et recette technique
État : terminé côté code, sécurité et recette E2E production

- [x] alignement du bucket Storage avec les formats réellement acceptés par la bibliothèque : images, audio, PDF et TXT ;
- [x] limite Storage conservée à 15 Mo et contrôle MIME côté application + bucket ;
- [x] vérification post-migration du bucket ;
- [x] audit sécurité Supabase relancé après modification ;
- [x] CI indépendante renforcée : installation déterministe, typecheck TypeScript puis build Next.js ;
- [x] checklist de recette bêta versionnée avec critères bloquants ;
- [x] normalisation durcie : home unique, slugs uniques, IDs/assetIds dédupliqués ;
- [x] correctif de la révision IA globale : application des modules depuis la bonne proposition ;
- [x] notes internes de planification retirées du rendu public et des metadata ;
- [x] sitemap nettoyé : exclusion des pages légales noindex ;
- [x] droits renforcés : source obligatoire avant publication d’un contenu sous licence/domaine public ;
- [x] build et production du dernier `main` validés via la release contrôlée ;
- [x] recette E2E complète production validée : authentification → création → droit Pro temporaire → AI Site Architect réel → média privé/public → publication → rendu public → feedback → archive → nettoyage ; HTTP 200 confirmé côté runtime ;
- [ ] validation finale des sous-domaines gérés en conditions réelles sur ce même déploiement ;
- [x] routage des sous-pages et pages légales corrigé sur les sous-domaines gérés, avec URLs de navigation propres ;
- [x] accès direct à `ai_usage_events` retiré aux clients et RPC de quota explicitement limité à `authenticated` / `service_role`, avec contrôle `auth.uid()` conservé ;
- [x] vérification des privilèges effective après migration : anon sans RPC, utilisateur connecté sans accès direct au ledger ;
- [ ] activer la protection Supabase contre les mots de passe compromis si elle est disponible sur l’offre utilisée (réglage Auth externe au code) ;
- [x] logique privilégiée du quota déplacée dans le schéma `private` derrière des wrappers publics `SECURITY INVOKER` ; RPC actif `consume_my_ai_generation` testé sous rôle authenticated avec résultat `ok` ;
- [x] compteur IA déplacé vers un RPC de lecture protégé : le client n’a toujours aucun SELECT/INSERT direct sur `ai_usage_events` ;
- [x] même durcissement appliqué au RPC public de formulaire de contact : wrapper invoker exposé, logique definer isolée hors schéma API ;
- [x] audit sécurité relancé : aucun avertissement `SECURITY DEFINER` exposé restant ;
- [x] dépendances npm directes figées sur les versions réellement verrouillées pour des builds reproductibles.

## Sprint 5 — monétisation

### Itération 5A — socle plans et droits
État : moteur de plans et droits terminé ; activation commerciale suspendue aux paramètres de vente et à Stripe

- [x] catalogue `Gratuit` / `Pro` centralisé en base ;
- [x] abonnements utilisateurs séparés des données éditoriales du site ;
- [x] RLS : lecture du catalogue authentifiée et lecture limitée à son propre abonnement ;
- [x] RPC `get_my_entitlements` en SECURITY INVOKER ;
- [x] quotas IA lus depuis l’offre au lieu de constantes applicatives ;
- [x] consommation IA sécurisée par `auth.uid()` et RLS, sans limites pilotables par le client ;
- [x] compteur d’usage IA journalier/mensuel visible dans « Mon offre » ;
- [x] droits préparés pour stockage, domaine personnalisé et AI Site Architect Premium ;
- [x] page `/plans` et accès « Mon offre » depuis le builder ;
- [x] types Supabase régénérés et migration versionnée ;
- [x] audit sécurité/performance post-migration et index de relation ajouté ;
- [ ] prix commercial, périodicité et éventuel essai à valider avant activation du paiement ;
- [ ] connecter Stripe et ses webhooks ;
- [x] droits Premium appliqués au runtime : domaine personnalisé côté repository et AI Site Architect côté API serveur ;
- [x] mesurer le stockage `site-media` par propriétaire et l’afficher dans « Mon offre » ;
- [x] refuser les nouveaux imports qui dépasseraient le quota de stockage de l’offre ;
- [x] conserver les restrictions Storage/RLS existantes et calculer l’usage depuis les métadonnées Storage en lecture seule ;
- [x] socle domaines personnalisés : droit Pro, demande normalisée, état pending/verified/failed et écran utilisateur ;
- [x] résolution publique d’un hostname personnalisé vérifié et navigation propre sur ce domaine ;
- [x] automatiser le rattachement et la vérification DNS/Vercel avant passage à `verified` ;
- [x] back-office administrateur protégé par rôle RLS, vue sites/offres/domaines et changement d’offre ;
- [x] aucun rôle administrateur attribué automatiquement : élévation volontaire uniquement ;
- [x] droits Premium retombent automatiquement sur le niveau gratuit lorsque l’abonnement n’est plus `active`/`trialing`, tout en conservant le vrai statut (`past_due`, `canceled`, `suspended`) pour l’interface ;
- [x] nouvelle publication bloquée pour un abonnement non régularisé, sans suppression automatique du site ni des données ;
- [ ] connecter le statut Stripe aux états d’abonnement et appliquer la politique finale de grâce/suspension une fois les délais commerciaux validés.

Les quotas actuels (Gratuit : 80 générations IA/mois et 250 Mo ; Pro : 500/mois et 2 Go) forment un catalogue bêta modifiable en base. Ils ne constituent pas encore l’offre commerciale définitive.

### Itération 5B — exploitation SaaS et domaines
État : exploitation applicative terminée ; intégrations externes Vercel/Stripe à connecter

- [x] quota de stockage mesuré et bloquant avant upload ;
- [x] demande de domaine personnalisé réservée au droit Pro ;
- [x] routage applicatif d’un hostname personnalisé vérifié ;
- [x] canonical public piloté par le domaine primaire réellement vérifié ; repli sûr vers `/site/{slug}` lorsqu’aucun domaine primaire vérifié n’existe ;
- [x] rôles administrateur séparés et protégés par RLS ;
- [x] back-office sites / offres / domaines ;
- [x] instrumentation first-party du funnel bêta, sans enregistrer les contenus éditoriaux ;
- [x] formulaire de feedback volontaire et vue admin des retours ;
- [x] audit Supabase post-implémentation : aucun nouveau warning sécurité applicatif ;
- [x] rattachement/vérification Vercel automatisé des domaines ; sous-domaines AJG gérés depuis le back-office, domaines personnels depuis l’espace propriétaire ;
- [ ] activation Stripe après validation de l’offre commerciale ;
- [x] moteur de droits déjà prêt pour `past_due` / `canceled` / `suspended` et blocage de nouvelle publication ;
- [ ] synchronisation Stripe → statuts et délais de grâce dès validation des paramètres commerciaux.

## Principe de conformité

Pour le profil ambassadeur MWR, la mention d'indépendance reste un bloc système. Les logos sont facultatifs et leur activation suppose que le membre dispose du droit d'utiliser les visuels. Pour une autre activité, les mentions MWR sont supprimées. L'éditeur ne génère pas encore toutes les informations légales propres à une activité indépendante ; elles doivent être vérifiées avant diffusion.


## Checkpoint fin des sprints codables — 28 septembre 2026

Le développement autonome prévu par cette roadmap est arrivé au bout de ce qui peut être finalisé sans décisions commerciales, accès/quotas externes ou observation d’utilisateurs réels.

Restent volontairement ouverts :
- sous-domaine canari `test-julien.voyage.ajgsolutionsgroup.com` validé côté Vercel/DNS ; la release contrôle désormais automatiquement son accessibilité HTTPS lorsqu’un alias AJG est attaché ;
- tests de plusieurs sites bêta et amélioration du template fondée sur ces observations ;
- activation du réglage Supabase Auth « leaked password protection » si l’offre le permet ;
- prix, périodicité, essai éventuel et délais de grâce à décider avant activation Stripe ;
- connexion Stripe/webhooks puis synchronisation de ses statuts ;
- automatisation de l’ajout et de la vérification des domaines personnalisés chez Vercel.

Ces points ne doivent pas être marqués terminés tant qu’ils n’ont pas été vérifiés dans leur environnement réel.



## Ordre d’exécution canonique — état au 28 septembre 2026

Cette section fait foi pour la prochaine reprise. Les cases ouvertes ailleurs dans la roadmap conservent l’historique détaillé, mais ne changent pas l’ordre de travail ci-dessous.

1. **Release contrôlée débloquée** : `VERCEL_TOKEN` GitHub Actions opérationnel, pipeline REST sécurisé avec vérification SHA/HTTP et rollback.
2. **Production synchronisée avec `main`** : dernière release contrôlée réussie et SHA exposé par `/api/health`.
3. **Préproduction technique validée sur les bloqueurs bêta** : Supabase public/serveur, IA, SHA, buckets Storage et Vercel runtime sont prêts ; l’URL applicative dispose d’un repli production sûr ; Resend et `CRON_SECRET` restent les warnings opérationnels à compléter.
4. **Storage privé validé de bout en bout** : `site-private-media` privé + RLS + test réel privé → `/api/media/promote` → public → nettoyage, tous en succès.
5. **Recette E2E réelle validée** : session admin → création isolée → droit Pro temporaire → AI Site Architect réel → médias → publication → site public → feedback → export → nettoyage.
6. **Routage réel AJG validé** : sous-domaine canari rattaché, CNAME configuré, domaine `verified + primary`, canonical automatique et contrôle HTTPS intégré au pipeline. Le domaine personnalisé utilisateur reste à recetter séparément avant lancement commercial.
7. **Lancer la bêta 5–10 comptes** : l’administration sait constituer la cohorte, isoler ses métriques et bloque les invitations tant que le gate technique critique n’est pas vert ; il reste à choisir/inviter les testeurs réels puis observer le dashboard 30 jours et corriger uniquement les frictions confirmées.
8. **Décisions commerciales utilisateur requises** : prix, périodicité, essai éventuel, nombre de sites inclus. La politique d’impayés reste J0/J14/J28/J104 sauf décision explicite signalée.
9. **Après validation commerciale seulement** : connecter Stripe, Checkout/portail, webhook signé, synchronisation des statuts et recette des scénarios de paiement.
10. **Option externe de sécurité** : activer Supabase Auth Leaked Password Protection lorsque le plan le permet.

Release production, Storage privé et recette E2E sont validés. Le sous-domaine canari AJG est désormais rattaché à Vercel et validé DNS. Le routage et les canonical n’utilisent plus de feature flag global : ils s’appuient sur le domaine primaire réellement vérifié, avec repli Vercel sinon.

## Sprint 6 — passage en SaaS commercialisable

État : démarré le 28 septembre 2026

### Itération 6A — release candidate et recette
- [x] identifier le blocage du dernier `main` : quota Vercel `build-rate-limit`, et non erreur applicative connue ;
- [x] conserver le dernier déploiement READY comme production de repli tant que la release candidate n’est pas validée ;
- [x] rendre le workflow Site Builder CI déclenchable manuellement pour disposer d’une validation indépendante ;
- [x] CI GitHub validée sur le dernier socle : `tsc --noEmit` puis `next build` réussissent indépendamment de Vercel ;
- [x] recette automatisée renforcée : test de l’archive de récupération puis démarrage réel de la release via `next start` avec smoke tests HTTP indépendants de Supabase/Vercel ;
- [x] vérification de révision déployée préparée : `/api/health` expose le SHA Vercel et `verify:deployment` bloque la recette si l’environnement ne sert pas le `main` attendu ;
- [x] release production contrôlée : auto-déploiements Git Vercel désactivés, workflow manuel prébuildé avec staging `--skip-domain`, smoke test puis promotion ;
- [x] rollback automatique vers le déploiement qui servait réellement l’alias production si la santé échoue après promotion ;
- [x] branche réservée `release/site-builder-production` comme déclencheur contrôlé alternatif à `workflow_dispatch`, avec vérification stricte qu’elle pointe sur le `main` courant ;
- [x] premier déclenchement de release contrôlée exécuté : workflow lancé correctement, arrêt avant Vercel car le secret GitHub Actions `VERCEL_TOKEN` est absent ; préflight corrigé pour s’exécuter après checkout ;
- [x] chemin de release basculé sur l’API REST Vercel pour contourner le bug PAT/CLI `/v2/user` ; après validation CI, déploiement production atomique, vérification SHA/HTTP et rollback automatique ;
- [x] cause HTTP 402 identifiée : `functionFailoverRegions` exige Enterprise ; failover `fra1` retiré, région principale `cdg1` conservée ;
- [x] release production contrôlée réussie sur `main` : build Production, SHA, promotion REST et contrôles HTTP publics validés ;
- [x] bootstrap privé exposé dans le back-office admin : création via l’API Storage Supabase avec le secret serveur Vercel ; la CI ne tente pas d’extraire une variable Sensitive ;
- [x] dernier `main` déployé en production via la release contrôlée ; `/api/health` expose le SHA attendu et la base répond `ok` ;
- [x] recette E2E production validée : toutes les étapes du runner passent, 1 génération IA réelle comptabilisée et aucun résidu site/abonnement/feedback/média après nettoyage.
- [x] canari AJG vérifié, DNS opérationnel et alias attaché au déploiement production ; diagnostic et release contrôlée vérifient désormais le HTTPS réel lorsqu’un canari est disponible.
- [ ] tester un domaine personnalisé utilisateur de bout en bout avant lancement commercial.

### Itération 6B — bêta mesurée
- [x] sous-domaines AJG retirés des opérations DNS côté utilisateur : préparation/vérification centralisée dans l’administration, avec file des domaines pending et instructions DNS réservées à AJG ;
- [x] l’API utilisateur de synchronisation est désormais limitée aux domaines personnels autorisés par l’offre ; les sous-domaines gérés exigent le rôle administrateur ;
- [x] instrumentation first-party et feedback déjà disponibles ;
- [x] dashboard bêta admin prêt : funnel utilisateurs distincts, usage IA réel, abandons descriptifs, feedback et activité par site sur 30 jours ;
- [x] gestion de cohorte bêta préparée dans l’administration : invitation e-mail volontaire, ajout d’un compte existant sans renvoi d’e-mail, retrait sans suppression du compte et limite de sécurité à 25 comptes ;
- [x] métriques isolées automatiquement sur la cohorte dès qu’au moins un testeur est marqué bêta ; avant cela, le dashboard indique explicitement qu’il couvre tous les utilisateurs ;
- [x] gate bêta privé ajouté et doublé côté serveur : l’interface désactive les invitations si un prérequis critique n’est pas au vert et l’API refait les contrôles avant toute invitation ; warnings non bloquants et fonctions commerciales différées restent séparés ;
- [x] cohorte opérationnelle volontairement plafonnée à 10 testeurs pour cette phase malgré la limite technique supérieure ;
- [ ] inviter puis faire tester 5 à 10 comptes réels ;
- [ ] mesurer activation, publication, usage IA, abandons et retours ;
- [ ] corriger uniquement les frictions confirmées par ces observations.

### Itération 6C — billing
- [x] modèle de droits et statuts d’abonnement prêt pour la synchronisation ;
- [x] quotas Gratuit/Pro séparés du prix commercial ;
- [ ] figer prix, périodicité, essai éventuel et délai de grâce ;
- [ ] connecter Stripe ;
- [ ] créer Checkout/portail client et webhook signé ;
- [ ] synchroniser les événements Stripe vers `user_subscriptions` ;
- [ ] tester renouvellement, échec de paiement, régularisation, annulation et suspension.

### Itération 6D — domaines personnalisés automatisés
- [x] modèle de données, entitlement, demande et routage applicatif déjà prêts ;
- [x] ajouter automatiquement le domaine au projet Vercel ;
- [x] présenter les enregistrements DNS requis ;
- [x] vérifier réellement le domaine avant passage à `verified` ;
- [x] gérer retrait, échec et nouvelle tentative.

### Gate de lancement
Le lancement commercial ne sera marqué prêt qu’après validation réelle de 6A, 6B, 6C et 6D. Les décisions tarifaires et les actions externes payantes ne sont jamais inventées par le code.


### Itération 6E — Billing Access & impayés
État : moteur serveur en cours, politique J0/J14/J28/J104 intégrée

- [x] état d’impayé isolé par site : `free/trial/active/grace/restricted/public_suspended/retention/closed` ;
- [x] journal de transitions et identifiant fournisseur dédupliquable ;
- [x] capacités indépendantes `read/edit/publish/ai/import/export/collect_leads/view_billing/public_site` ;
- [x] J0–J14 : édition et publication maintenues, IA bloquée sans fallback vers le quota Free ;
- [x] J14 : édition, publication, import et collecte de formulaires bloqués ; lecture/export/paiement conservés ;
- [x] J28 : suspension publique appliquée aux routes slug et domaines personnalisés via un état serveur ;
- [x] J104 : passage en rétention/contrôle sans suppression automatique irréversible ;
- [x] Storage RLS bloque upload/update/delete direct après restriction tout en conservant la lecture des médias existants pour récupération ;
- [x] scheduler PostgreSQL quotidien idempotent pour faire avancer les échéances ;
- [x] test transactionnel du passage `grace → public_suspended` et de la suspension publique ;
- [x] écran propriétaire avec état et dates J14/J28/J104, export et emplacement de l’action de régularisation ; bouton paiement volontairement inactif avant Stripe ;
- [x] export structuré JSON v2 derrière endpoint serveur authentifié : configuration, domaines, carnets, messages de contact et inventaire récursif des médias ;
- [x] export d’archive TAR.GZ avec copie binaire des médias publics et privés, manifeste JSON et rapport d’échec partiel ;
- [x] file de notifications J0/J3/J7/J12/J74/J97 + réactivation, dédupliquée et avec worker Resend idempotent ; activation réelle après présence des secrets serveur et déploiement ;
- [ ] ingestion Stripe signée/idempotente et réconciliation fournisseur ;
- [x] primitive serveur de réactivation après paiement confirmé : droits, site public et relances rétablis/annulés de façon idempotente ; branchement fournisseur restant à faire ;
- [x] recette temporelle transactionnelle : J13, J14, J28/J104, réactivation, isolation de deux sites et blocage d’un UPDATE direct ; appels HTTP de production et fournisseur à finaliser après déploiement ;
- [x] RLS durcies : un site suspendu n’est plus lisible anonymement via Data API et les mutations directes sites/drafts/domaines/Storage sont bloquées à partir de J14 ;
- [x] formulaire anonyme retesté : accès minimal au schéma privé corrigé, soumission active validée et rejet J14 validé ;
- [x] événements de facturation désormais ciblables par site : un impayé sur le site A ne suspend pas le site B du même propriétaire ;
- [x] entitlements de plan ciblés par site pour IA avancée et domaines ; quotas anti-abus IA restent volontairement agrégés au compte ;
- [ ] validation production après réouverture du pipeline Vercel.

### Durcissement préproduction — 28 septembre 2026
- [x] administration des offres alignée sur la facturation par site, sans mutation involontaire des autres sites du propriétaire ;
- [x] table des rôles admin durcie : clients authentifiés en lecture seule, auto-promotion SQL refusée ;
- [x] workflow de triage des retours bêta réservé aux administrateurs ;
- [x] événement `publish_success` rattaché à l’identifiant réellement retourné par la publication ;
- [x] anciennes URLs `/site/{slug}` sur sous-domaines gérés redirigées vers l’URL publique propre ;
- [x] CI post-durcissement validée : TypeScript et build Next.js réussissent ;
- [x] diagnostic admin de préproduction : présence des secrets, révision Vercel et buckets Storage vérifiés sans exposer les valeurs ;
- [x] validation active en lecture du token serveur Vercel contre le projet configuré, avec timeout et sans exposition de la réponse sensible ;
- [x] bootstrap Storage privé directement depuis l’administration, protégé par session + rôle admin et sans secret temporaire supplémentaire ;
- [ ] activer la protection Supabase contre les mots de passe compromis si le plan/projet le permet.

### Recette impayés — moteur d’accès
- [x] J13 vérifié : lecture, édition, publication, import, export et formulaires restent actifs ; IA désactivée ; site public actif ;
- [x] J14 vérifié : passage `restricted`, édition/publication/import/formulaires/IA bloqués, export et site public maintenus ;
- [x] J28 vérifié : passage `public_suspended`, site public suspendu, export maintenu ;
- [x] J104+ vérifié : passage `retention`, aucune suppression automatique ;
- [x] régularisation vérifiée : retour `active`, accès public rétabli et rappels en attente annulés ;
- [x] adaptateur historique compte-entier désactivé ; seuls les événements de paiement ciblés par site restent exécutables ;
- [x] formulaire public testé : accepté pendant la grâce, refusé dès J14 ; wrapper anonyme conforme au linter Supabase.

### Préproduction — cohérence serveur
- [x] export de récupération désormais explicitement ciblé par `siteId` et ownership vérifié côté serveur ;
- [x] routes serveur compatibles avec `SUPABASE_SECRET_KEY` actuelle, avec repli temporaire sur l’ancienne clé service-role ;
- [x] textes de rétention J74/J97 alignés avec la politique sans suppression automatique ;
- [x] dernier état contrôlé : TypeScript et build Next.js réussissent sur la CI indépendante ;
- [x] production Vercel resynchronisée avec le `main` courant ; `/api/health`, login, routes critiques et SHA sont validés par la release contrôlée.

### Stockage média — dette préproduction
- [x] séparer dans le code les médias publiables et la bibliothèque privée ; activation physique du bucket privé encore à effectuer après déploiement ;
- [x] RLS propriétaire du bucket privé préparées et imports de bibliothèque basculés vers des références privées stables ;
- [x] bootstrap serveur idempotent de `site-private-media` via le SDK Storage, déclenchable uniquement par un administrateur authentifié ;
- [x] après déploiement du `main`, bootstrap exécuté depuis l’administration ; bucket `site-private-media` réel vérifié privé, limite 15 Mo et politiques RLS SELECT/INSERT/UPDATE/DELETE présentes ;
- [x] promotion contrôlée privée → publique branchée à la publication : session + ownership + capacité de publication + droits/licence vérifiés côté serveur ;
- [x] références `private://` exclues du rendu public et copie rendue répétable pour les republications ;
- [x] recette réelle Storage validée : le contrôle admin a exécuté plusieurs fois `site-private-media` → `/api/media/promote` → URL publique avec HTTP 200, puis nettoyage complet sans résidu.
- [x] runner E2E complet admin validé en production après correctif du droit Pro temporaire ; toutes les étapes sont passées et le nettoyage final est confirmé sans résidu.

### Domaines personnalisés — automatisation
- [x] demande de domaine limitée au site propriétaire et à l’entitlement Pro ; la création force toujours `pending / non-primary` ;
- [x] auto-vérification directe par le propriétaire bloquée en RLS et par révocation du privilège UPDATE ;
- [x] rattachement et vérification Vercel préparés côté serveur, avec instructions DNS et relance de vérification dans l’UI ;
- [x] un seul domaine primaire conservé après vérification ;
- [x] suppression préparée côté serveur : détachement Vercel avant suppression Supabase ;
- [x] canari géré `test-julien` : token runtime, rattachement Vercel, CNAME externe, `misconfigured=false`, `verified + primary` et canonical validés ; le pipeline contrôle désormais le HTTPS de l’alias attaché.
- [ ] domaine personnalisé utilisateur : exécuter une recette ajout → DNS → vérification → primaire → retrait.

### Blocages externes avant release candidate réelle
- [x] Vercel : production synchronisée avec le `main` via le workflow contrôlé ; token GitHub Actions, build, vérification SHA, promotion et rollback sont opérationnels ;
- [x] Storage : `site-private-media` créé, vérifié privé et recette de promotion réelle validée ;
- [ ] Secrets serveur : `SUPABASE_SECRET_KEY`, token de release GitHub et `VERCEL_TOKEN / PROJECT_ID / TEAM_ID` runtime validés ; l’URL applicative a un repli production sûr ; restent `CRON_SECRET` et Resend à configurer avant activation des notifications ; secret fournisseur de paiement seulement lorsque ce fournisseur sera choisi ;
- [ ] Auth : activer la protection Supabase contre les mots de passe compromis si disponible sur le plan.

### Cohérence multi-site complémentaire
- [x] stockage affiché dans l’écran Offres calculé pour le site courant, et non plus pour tout le compte ;
- [x] export de récupération inventorie désormais les médias publics et privés sans fabriquer d’URL publique pour les fichiers privés ;
- [x] job Postgres quotidien d’avancement des états d’impayé confirmé actif à 02:15 ;
- [x] audit sécurité Supabase relancé : seule l’option externe de mots de passe compromis reste en avertissement ;
- [x] audit performance relancé : uniquement des index encore peu/non utilisés en bêta, aucune suppression prématurée effectuée.

### Multi-site UI — isolation opérationnelle
- [x] repository capable de cibler explicitement un `siteId` et de lister les sites du compte ;
- [x] autosave et sauvegardes Builder liés au site actif ;
- [x] sélecteur de site ajouté au Builder pour les comptes possédant plusieurs sites ;
- [x] Domaines, Facturation/Récupération et Offres/quotas ciblent le site sélectionné ;
- [ ] création d’un site supplémentaire volontairement différée jusqu’à validation du nombre de sites inclus par offre commerciale.

### Résilience facturation — recette complémentaire
- [x] les échecs de paiement répétés ne redémarrent plus J0/J14/J28 et ne peuvent plus faire repasser un site restreint en grâce ; test transactionnel validé ;
- [x] les notifications restées `processing` après interruption d’un worker sont récupérées après 30 minutes, dans la limite de 5 tentatives ; test transactionnel validé ;
- [x] webhook provider limité à 64 Ko, timestamps validés et longueurs d’identifiants bornées ;
- [x] audit sécurité Supabase après modifications : aucun défaut SQL/RLS, seul le contrôle de mots de passe compromis reste indisponible tant que le projet n’est pas sur Supabase Pro.

### Release gate — état courant
- [x] CI indépendante : TypeScript + build Next.js verts sur les derniers changements fonctionnels ;
- [x] sécurité DB : fonctions critiques impayés/queue exécutables uniquement par `service_role` ; audit RLS sans erreur ;
- [x] multi-site : isolation DB + ciblage UI Builder/Domaines/Facturation/Offres ;
- [x] résilience impayés : répétition d’échec sans reset du calendrier + reprise des jobs email bloqués ;
- [x] récupération client : archive TAR.GZ streamée avec manifeste v3 et copie des médias publics/privés, sans nouvelle dépendance ;
- [x] domaines : endpoints Vercel utilisés conformes à la documentation actuelle ;
- [x] Vercel : production synchronisée sur `91ac1c3…` ; `/api/health` retourne HTTP 200, `database: ok`, environnement `production` et région `cdg1` ;
- [x] Storage privé : bucket réel, politiques RLS et recette privée → promotion publique → nettoyage validés ;
- [x] secrets de release : `SUPABASE_SECRET_KEY` runtime et `VERCEL_TOKEN` GitHub Actions ont permis la release contrôlée et la recette Storage ;
- [ ] secrets opérationnels restants : confirmer/configurer `CRON_SECRET`, Resend, `NEXT_PUBLIC_APP_URL` et le token Vercel runtime à périmètre minimal pour les domaines personnalisés ;
- [ ] paiement réel : volontairement non activé avant validation prix/périodicité/essai et nombre de sites inclus par offre ;
- [ ] Supabase Auth leaked-password protection : disponible uniquement avec Supabase Pro selon la documentation actuelle.

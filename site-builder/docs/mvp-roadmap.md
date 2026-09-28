# Roadmap MVP — AJG Site Builder

Dernière mise à jour : 28 septembre 2026.

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
- [ ] validation complète des sous-domaines en conditions réelles ;
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
État : terminé côté code sur `main` ; recette de déploiement à confirmer

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
- [x] éditeur visuel de l’arborescence après génération : ordre, activation, suppression, ajout, type, URL, rôle et contenus affectés ;
- [x] limite de 6 pages alignée entre IA, normalisation et éditeur ; accueil unique et non déplaçable ;
- [x] IDs de contenus publiables transmis à l’AI Site Architect afin que l’affectation d’assets soit réellement exploitable.

Checkpoint de l’itération : le modèle de données, le moteur IA, la persistance, le rendu multipage et les garde-fous de droits sont reliés de bout en bout. La révision globale et l’éditeur visuel sont désormais également codés ; la recette du build et de la production reste nécessaire avant validation bêta.

### Itération 4B — contrôle humain avancé du site Premium
État : terminé côté code sur `main` ; recette de déploiement à effectuer

- [x] import direct de contenus utilisateur dans la bibliothèque ;
- [x] affectation IA des contenus autorisés aux pages ;
- [x] blocage des références vers des assets non autorisés avant publication ;
- [x] rendu public des images, textes, audios et documents affectés ;
- [x] conversation de révision globale avec aperçu structuré avant application ;
- [x] éditeur visuel d’arborescence et réaffectation manuelle des contenus.

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
État : terminé côté code et sécurité contrôlable ; recette production suspendue au quota de build Vercel

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
- [ ] exécuter la recette build + parcours complet sur le dernier `main` dès réouverture du pipeline Vercel ;
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
- [ ] automatiser le rattachement et la vérification DNS/Vercel avant passage à `verified` ;
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
- [x] canonical des sites gérés aligné sur le sous-domaine public ;
- [x] rôles administrateur séparés et protégés par RLS ;
- [x] back-office sites / offres / domaines ;
- [x] instrumentation first-party du funnel bêta, sans enregistrer les contenus éditoriaux ;
- [x] formulaire de feedback volontaire et vue admin des retours ;
- [x] audit Supabase post-implémentation : aucun nouveau warning sécurité applicatif ;
- [ ] rattachement/vérification Vercel automatisé des domaines ;
- [ ] activation Stripe après validation de l’offre commerciale ;
- [x] moteur de droits déjà prêt pour `past_due` / `canceled` / `suspended` et blocage de nouvelle publication ;
- [ ] synchronisation Stripe → statuts et délais de grâce dès validation des paramètres commerciaux.

## Principe de conformité

Pour le profil ambassadeur MWR, la mention d'indépendance reste un bloc système. Les logos sont facultatifs et leur activation suppose que le membre dispose du droit d'utiliser les visuels. Pour une autre activité, les mentions MWR sont supprimées. L'éditeur ne génère pas encore toutes les informations légales propres à une activité indépendante ; elles doivent être vérifiées avant diffusion.


## Checkpoint fin des sprints codables — 28 septembre 2026

Le développement autonome prévu par cette roadmap est arrivé au bout de ce qui peut être finalisé sans décisions commerciales, accès/quotas externes ou observation d’utilisateurs réels.

Restent volontairement ouverts :
- recette du dernier `main` et validation réelle des sous-domaines dès qu’un nouveau build Vercel est disponible ;
- tests de plusieurs sites bêta et amélioration du template fondée sur ces observations ;
- activation du réglage Supabase Auth « leaked password protection » si l’offre le permet ;
- prix, périodicité, essai éventuel et délais de grâce à décider avant activation Stripe ;
- connexion Stripe/webhooks puis synchronisation de ses statuts ;
- automatisation de l’ajout et de la vérification des domaines personnalisés chez Vercel.

Ces points ne doivent pas être marqués terminés tant qu’ils n’ont pas été vérifiés dans leur environnement réel.


## Sprint 6 — passage en SaaS commercialisable

État : démarré le 28 septembre 2026

### Itération 6A — release candidate et recette
- [x] identifier le blocage du dernier `main` : quota Vercel `build-rate-limit`, et non erreur applicative connue ;
- [x] conserver le dernier déploiement READY comme production de repli tant que la release candidate n’est pas validée ;
- [x] rendre le workflow Site Builder CI déclenchable manuellement pour disposer d’une validation indépendante ;
- [ ] obtenir un build du dernier `main` dès réouverture du quota Vercel ;
- [ ] exécuter la recette E2E authentification → création → IA → médias → publication → site public → feedback ;
- [ ] valider sous-domaines et domaines personnalisés en environnement réel.

### Itération 6B — bêta mesurée
- [x] instrumentation first-party et feedback déjà disponibles ;
- [ ] faire tester 5 à 10 comptes réels ;
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
- [ ] ajouter automatiquement le domaine au projet Vercel ;
- [ ] présenter les enregistrements DNS requis ;
- [ ] vérifier réellement le domaine avant passage à `verified` ;
- [ ] gérer retrait, échec et nouvelle tentative.

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
- [ ] export d’archive avec copie binaire des médias à ajouter avant lancement commercial ;
- [x] file de notifications J0/J3/J7/J12/J74/J97 + réactivation, dédupliquée et avec worker Resend idempotent ; activation réelle après présence des secrets serveur et déploiement ;
- [ ] ingestion Stripe signée/idempotente et réconciliation fournisseur ;
- [x] primitive serveur de réactivation après paiement confirmé : droits, site public et relances rétablis/annulés de façon idempotente ; branchement fournisseur restant à faire ;
- [ ] recette temporelle complète : J13, J14, J28/J104, réactivation, isolation de deux sites et blocage d’un UPDATE direct vérifiés transactionnellement ; appels HTTP de production et paiement fournisseur à finaliser avec le déploiement ;
- [x] RLS durcies : un site suspendu n’est plus lisible anonymement via Data API et les mutations directes sites/drafts/domaines/Storage sont bloquées à partir de J14 ;
- [x] formulaire anonyme retesté : accès minimal au schéma privé corrigé, soumission active validée et rejet J14 validé ;
- [x] événements de facturation désormais ciblables par site : un impayé sur le site A ne suspend pas le site B du même propriétaire ;
- [ ] validation production après réouverture du pipeline Vercel.

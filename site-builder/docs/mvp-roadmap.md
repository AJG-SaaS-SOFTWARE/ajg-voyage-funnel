# Roadmap MVP — AJG Site Builder

Dernière mise à jour : 27 septembre 2026.

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
- [ ] domaine personnalisé en option.

## Sprint 4 — onboarding, IA et qualité bêta
État : socle fonctionnel, validation bêta à poursuivre

- [x] questionnaire guidé 3+1 pour préparer les textes ;
- [x] transformation de réponses courtes ou mots-clés en textes structurés ;
- [x] assistant IA dans les champs éditoriaux ;
- [x] actions rapides Améliorer / Plus naturel / Plus chaleureux / Plus professionnel / Plus court / Nouvelle proposition ;
- [x] validation humaine avant tout remplacement de texte ;
- [x] Quality Check avant publication ;
- [x] relecture IA orthographe, grammaire, cohérence, répétitions, clarté marketing et CTA ;
- [x] contrôles liens HTTPS, champs incomplets, modules, contraste, longueurs mobile, cadrage et légendes d'images ;
- [ ] création et observation de plusieurs sites bêta réels ;
- [ ] mesure des abandons du builder ;
- [ ] journal structuré de retours utilisateur ;
- [ ] amélioration continue du template public sur la base des tests.

## Itération 4A — AI Site Architect, architecture et contenus utilisateur
État : code fonctionnel livré sur `main`, recette de déploiement à confirmer

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
- [x] éditeur visuel de l’arborescence après génération : ordre, activation, suppression, ajout, type, URL, rôle et contenus affectés.

Checkpoint de l’itération : le modèle de données, le moteur IA, la persistance, le rendu multipage et les garde-fous de droits sont reliés de bout en bout. La révision globale et l’éditeur visuel sont désormais également codés ; la recette du build et de la production reste nécessaire avant validation bêta.

### Itération 4B — contrôle humain avancé du site Premium
État : terminé en code sur `main`, recette de déploiement à effectuer

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
- [x] accès direct à `ai_usage_events` retiré aux clients et RPC de quota explicitement limité à `authenticated` / `service_role`, avec contrôle `auth.uid()` conservé ;
- [x] vérification des privilèges effective après migration : anon sans RPC, utilisateur connecté sans accès direct au ledger ;
- [ ] activer la protection Supabase contre les mots de passe compromis si elle est disponible sur l’offre utilisée (réglage Auth externe au code) ;
- [ ] décider après recette si le RPC de quota doit être déplacé vers un schéma API/interne dédié afin d’éliminer également l’avertissement `SECURITY DEFINER`.

## Sprint 5 — monétisation

### Itération 5A — socle plans et droits
État : socle technique livré sur `main`, paiement volontairement non activé

- [x] catalogue `Gratuit` / `Pro` centralisé en base ;
- [x] abonnements utilisateurs séparés des données éditoriales du site ;
- [x] RLS : lecture du catalogue authentifiée et lecture limitée à son propre abonnement ;
- [x] RPC `get_my_entitlements` en SECURITY INVOKER ;
- [x] quotas IA lus depuis l’offre au lieu de constantes applicatives ;
- [x] droits préparés pour stockage, domaine personnalisé et AI Site Architect Premium ;
- [x] page `/plans` et accès « Mon offre » depuis le builder ;
- [x] types Supabase régénérés et migration versionnée ;
- [x] audit sécurité/performance post-migration et index de relation ajouté ;
- [ ] prix commercial, périodicité et éventuel essai à valider avant activation du paiement ;
- [ ] connecter Stripe et ses webhooks ;
- [ ] appliquer les droits Premium au runtime une fois le paiement opérationnel ;
- [ ] mesurer et bloquer le stockage total selon l’offre ;
- [ ] domaines personnalisés ;
- [ ] back-office administrateur ;
- [ ] suspension automatique en cas d’impayé.

Les quotas actuels (Gratuit : 80 générations IA/mois et 250 Mo ; Pro : 500/mois et 2 Go) forment un catalogue bêta modifiable en base. Ils ne constituent pas encore l’offre commerciale définitive.

## Principe de conformité

Pour le profil ambassadeur MWR, la mention d'indépendance reste un bloc système. Les logos sont facultatifs et leur activation suppose que le membre dispose du droit d'utiliser les visuels. Pour une autre activité, les mentions MWR sont supprimées. L'éditeur ne génère pas encore toutes les informations légales propres à une activité indépendante ; elles doivent être vérifiées avant diffusion.

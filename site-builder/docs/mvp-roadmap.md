# Roadmap MVP — AJG Site Builder

Dernière mise à jour : 25 septembre 2026.

## Sprint 1 — configurateur utilisable
État : terminé pour le prototype bêta

- [x] application Next.js isolée ;
- [x] parcours guidé en 6 étapes ;
- [x] aperçu en direct ;
- [x] validation des champs essentiels ;
- [x] sauvegarde locale automatique des modifications ;
- [x] sauvegarde distante Supabase ;
- [x] upload réel de photo de profil ;
- [x] publication partageable ;
- [x] personnalisation des couleurs, fonds, motifs, image et son ;
- [x] profil MWR ou activité indépendante, logos facultatifs ;
- [x] conformité verrouillée ;
- [x] base FR / EN.

## Sprint 2 — Supabase
État : socle opérationnel

- [x] projet Supabase dédié ;
- [x] Auth email / Magic Link ;
- [x] tables sites, media, travel_journals et domains ;
- [x] RLS et relations principales ;
- [x] Storage pour les médias ;
- [x] repository Supabase côté application ;
- [x] contrôle sécurité Supabase sans alerte active.

## Sprint 3 — publication multi-tenant
État : largement opérationnel

- [x] résolution du site par hostname ;
- [x] sous-domaines gérés ;
- [x] rendu public SSR ;
- [x] métadonnées SEO et canonical ;
- [x] statuts brouillon / publié / suspendu côté données ;
- [x] page introuvable pour un site non publié ;
- [ ] sitemap par site ;
- [ ] validation complète des sous-domaines en conditions réelles ;
- [ ] domaine personnalisé en option.

## Sprint 4 — onboarding bêta
État : prochaine priorité

- [ ] questionnaire de démarrage simplifié ;
- [ ] assistant rédactionnel ;
- [ ] création de plusieurs sites bêta réels ;
- [ ] mesure des abandons du builder ;
- [ ] journal de retours utilisateur ;
- [ ] amélioration continue du template public.

## Modules de contenu envisagés

1. Carnets de voyage : récits, photos et pages individuelles ; aucun contenu factice publié.
2. Galerie : collections d'images avec légendes et crédits.
3. Questions fréquentes : ajout, ordre et masquage des réponses.
4. Témoignages : uniquement avec accord des personnes citées.
5. Contact : formulaire avec protection contre les abus et gestion des données.

L'ordre sera ajusté après les retours de bêta. Ces modules ne sont pas encore disponibles.

## Sprint 5 — monétisation

- [ ] plans et droits par offre ;
- [ ] Stripe ;
- [ ] quotas stockage / IA ;
- [ ] domaines personnalisés ;
- [ ] back-office administrateur ;
- [ ] suspension automatique en cas d'impayé.

## Principe de conformité

Pour le profil ambassadeur MWR, la mention d'indépendance reste un bloc système même si les logos ne sont pas affichés. Les logos sont facultatifs et leur activation suppose que le membre dispose du droit d'utiliser les visuels. Pour une autre activité, les mentions MWR sont supprimées. L'éditeur ne génère pas encore les informations légales propres à cette activité ; elles doivent être vérifiées avant diffusion.

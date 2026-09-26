# Roadmap MVP — AJG Site Builder

Dernière mise à jour : 26 septembre 2026.

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
- [ ] sitemap par site ;
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

## Sprint 5 — monétisation

- [ ] plans et droits par offre ;
- [ ] Stripe ;
- [ ] quotas stockage / IA par plan commercial ;
- [ ] domaines personnalisés ;
- [ ] back-office administrateur ;
- [ ] suspension automatique en cas d'impayé.

## Principe de conformité

Pour le profil ambassadeur MWR, la mention d'indépendance reste un bloc système. Les logos sont facultatifs et leur activation suppose que le membre dispose du droit d'utiliser les visuels. Pour une autre activité, les mentions MWR sont supprimées. L'éditeur ne génère pas encore toutes les informations légales propres à une activité indépendante ; elles doivent être vérifiées avant diffusion.

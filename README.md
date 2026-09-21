# AJG Voyage Funnel — V1

Landing page mobile-first pour qualifier des prospects intéressés par Travel Advantage et les orienter vers une présentation.

## Production
- Site : https://ajg-voyage.netlify.app/
- Hébergement : Netlify
- Collecte : Netlify Forms (`travel-presentation`)
- Réservation : Calendly — Présentation Travel Advantage, 30 min
- Dépôt : `AJG-SaaS-SOFTWARE/ajg-voyage-funnel`

## Inclus
- landing page responsive
- questionnaire en 4 étapes
- scoring léger des leads
- capture automatique UTM + URL d’entrée + référent
- formulaire compatible Netlify Forms
- honeypot anti-spam
- consentement marketing B2C séparé et facultatif
- page de confirmation non indexable
- réservation Calendly
- notice de confidentialité et mentions légales
- sitemap + robots.txt
- métadonnées SEO et partage social
- headers de sécurité Netlify
- styles de focus clavier et prise en charge de `prefers-reduced-motion`

## Déploiement
La branche de production est `main`. Netlify redéploie automatiquement après fusion sur `main`.

Pour éviter des déploiements de production inutiles, développer sur une branche et fusionner après revue. Les Deploy Previews peuvent servir aux contrôles avant production.

## Structure
- `index.html` : landing + questionnaire
- `app.js` : logique multi-étapes, validation, scoring et attribution
- `styles.css` : design responsive et accessibilité
- `merci.html` : confirmation + CTA Calendly
- `confidentialite.html` : notice RGPD
- `mentions.html` : mentions légales
- `robots.txt` / `sitemap.xml` : indexation
- `netlify.toml` : publication et headers de sécurité

## À mettre à jour lors de l’immatriculation
- statut juridique
- SIREN / RNE ou RCS selon le cas
- éventuel nom commercial / raison sociale
- mentions légales et responsable de traitement si les coordonnées changent

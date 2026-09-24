# AJG Voyage Funnel — FR / EN

Landing page mobile-first pour qualifier des prospects intéressés par Travel Advantage et les orienter vers une présentation.

## Production
- Site FR : https://voyage.ajgsolutionsgroup.com/
- Site EN : https://voyage.ajgsolutionsgroup.com/en/
- Hébergement : Netlify
- Collecte : Netlify Forms (`travel-presentation`)
- Réservation FR : Google Calendar — présentation individuelle avec Benoit
- Réservation EN : Calendly — présentation individuelle avec Thibaut
- Dépôt : `AJG-SaaS-SOFTWARE/ajg-voyage-funnel`

## Inclus
- landing pages responsive en français et en anglais
- sélecteur FR / EN avec conservation des paramètres UTM
- questionnaire en 4 étapes
- scoring léger des leads
- capture automatique UTM + URL d’entrée + référent
- formulaire compatible Netlify Forms
- honeypot anti-spam
- consentement marketing B2C séparé et facultatif
- page de confirmation non indexable
- réservation Google Calendar côté français
- réservation Calendly côté anglais
- notice de confidentialité et mentions légales
- sitemap + robots.txt
- métadonnées SEO et partage social
- headers de sécurité Netlify
- styles de focus clavier et prise en charge de `prefers-reduced-motion`

## Déploiement
La branche de production est `main`. Netlify redéploie automatiquement après fusion sur `main`.

Pour éviter des déploiements de production inutiles, développer sur une branche et fusionner après revue. Les Deploy Previews peuvent servir aux contrôles avant production.

## Structure
- `index.html` : landing + questionnaire français
- `en/index.html` : landing + questionnaire anglais
- `app.js` : logique multi-étapes, validation, scoring et attribution
- `styles.css` : design responsive et accessibilité
- `merci.html` : confirmation FR + CTA Google Calendar Benoit
- `en/thanks.html` : confirmation EN + CTA Calendly Thibaut
- `confidentialite.html` / `mentions.html` : pages légales françaises
- `en/privacy.html` / `en/legal.html` : traductions anglaises
- `robots.txt` / `sitemap.xml` : indexation
- `netlify.toml` : publication et headers de sécurité

## À mettre à jour lors de l’immatriculation
- statut juridique
- SIREN / RNE ou RCS selon le cas
- éventuel nom commercial / raison sociale
- mentions légales et responsable de traitement si les coordonnées changent

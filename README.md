# AJG Voyage Funnel — FR / EN

Landing page mobile-first pour qualifier des prospects intéressés par Travel Advantage et les orienter vers une présentation.

## Production
- Site FR : https://voyage.ajgsolutionsgroup.com/
- Site EN : https://voyage.ajgsolutionsgroup.com/en/
- Hébergement : Vercel
- Collecte : API Vercel `/api/travel-presentation` → Supabase (`ajg_voyage_leads`), avec notification technique via Resend
- Réservation FR / EN : Calendly — présentation individuelle avec Thibaut
- Dépôt : `AJG-SaaS-SOFTWARE/ajg-voyage-funnel`

## Inclus
- landing pages responsive en français et en anglais
- sélecteur FR / EN avec conservation des paramètres UTM
- questionnaire en 4 étapes
- scoring léger des leads
- capture automatique UTM + URL d’entrée + référent
- formulaire envoyé côté serveur vers l’API Vercel, avec stockage Supabase
- honeypot anti-spam
- consentement marketing B2C séparé et facultatif
- page de confirmation non indexable
- réservation Calendly côté français et anglais
- notice de confidentialité et mentions légales
- sitemap + robots.txt
- métadonnées SEO et partage social
- headers de sécurité Vercel
- styles de focus clavier et prise en charge de `prefers-reduced-motion`

## Déploiement
La branche de production est `main`. Vercel publie la production depuis `main`.

Méthode de référence : développer par sprint sur une branche dédiée, regrouper les changements, contrôler la Preview Vercel et ne fusionner sur `main` qu’une fois l’itération validée. Éviter les micro-déploiements de production.

## Structure
- `index.html` : landing + questionnaire français
- `en/index.html` : landing + questionnaire anglais
- `app.js` : logique multi-étapes, validation, scoring et attribution
- `styles.css` : design responsive et accessibilité
- `merci.html` / `en/thanks.html` : confirmations FR / EN + CTA Calendly
- `confidentialite.html` / `mentions.html` : pages légales françaises
- `en/privacy.html` / `en/legal.html` : traductions anglaises
- `robots.txt` / `sitemap.xml` : indexation
- `api/travel-presentation.js` : validation serveur, stockage Supabase et notification Resend
- `vercel.json` : région d’exécution et headers de sécurité

## À mettre à jour lors de l’immatriculation
- statut juridique
- SIREN / RNE ou RCS selon le cas
- éventuel nom commercial / raison sociale
- mentions légales et responsable de traitement si les coordonnées changent

# AJG Voyage Funnel — V1

Landing page mobile-first pour qualifier des prospects intéressés par Travel Advantage et les orienter vers une présentation.

## Inclus
- landing page responsive
- questionnaire en 4 étapes
- scoring léger des leads
- capture automatique des paramètres UTM
- formulaire compatible Netlify Forms
- honeypot anti-spam
- consentement de contact + consentement marketing séparé
- page de confirmation
- pages confidentialité et mentions légales à finaliser avant publication
- headers de sécurité Netlify

## Déploiement Netlify
1. Importer ce dépôt dans Netlify.
2. Build command : laisser vide.
3. Publish directory : `.`
4. Déployer.
5. Vérifier dans Netlify > Forms que `travel-presentation` est détecté.

## Avant mise en ligne publique
- remplacer le bouton de réservation sur `merci.html` par votre URL Cal.com
- compléter mentions légales + responsable de traitement + contact RGPD
- valider le wording avec les règles de communication/compliance applicables à votre statut Travel Advantage
- connecter le domaine choisi
- effectuer un test réel de soumission Netlify

## Structure
- `index.html` : landing + questionnaire
- `app.js` : logique multi-étapes, validation, scoring, UTM
- `styles.css` : design responsive
- `success.js` : interaction de la page de confirmation
- `merci.html` : confirmation + futur CTA Cal.com
- `confidentialite.html` : notice RGPD à finaliser
- `mentions.html` : mentions légales à finaliser
- `netlify.toml` : déploiement et headers de sécurité

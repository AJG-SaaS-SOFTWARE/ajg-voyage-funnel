# Inventaire des ressources externes — AJG Voyage

Revue : 26 septembre 2026

## Chargements automatiques observés dans le code

### Unsplash — images.unsplash.com
Ressource tierce chargée directement par certaines pages/styles. URLs actuellement référencées :
- photo-1507525428034-b723cf961d3e (variantes 2000 px et 1200 px) — visuel principal / métadonnées sociales ;
- photo-1539020140153-e479b8c22e70 — illustration utilisée par le site ;
- photo-1770657252526-bedcff85f1c7 — illustration de côte méditerranéenne / Grèce.

**Action :** migrer ces visuels vers `/assets/` en conservant les crédits/licences applicables. Tant que cette migration n’est pas terminée, maintenir l’information correspondante dans la notice de confidentialité.

## Services externes ouverts uniquement sur action de l’utilisateur

### Calendly
Les liens de réservation ouvrent `calendly.com` dans un nouvel onglet. Calendly n’est pas embarqué dans AJG Voyage. Aucun script ou iframe Calendly n’est chargé automatiquement sur la page AJG Voyage auditée.

### CNIL / Netlify et autres liens légaux
Les liens externes présents dans les pages légales ne chargent pas leurs services tant que l’utilisateur ne clique pas dessus.

## Scripts / analytics / pixels

Lors de la revue du code :
- pas de Google Analytics ;
- pas de Google Tag Manager ;
- pas de Meta Pixel ;
- pas de TikTok Pixel ;
- pas de Hotjar ;
- pas d’iframe Calendly ;
- pas de police Google Fonts distante détectée dans la configuration principale ;
- scripts applicatifs servis localement (`/language.js`, `/app.js`).

## Stockage navigateur

`localStorage: ajg_language_preference` — valeur `fr` ou `en`, créée lorsque l’utilisateur choisit explicitement une langue. Finalité : personnalisation de l’interface. Aucun usage publicitaire ou intersites.

## Contrôle à chaque évolution

Avant tout nouveau service tiers, vérifier : domaine contacté, données transmises, cookies/localStorage, finalité, base légale, consentement éventuel, durée, transferts internationaux et mise à jour de la notice/registre.

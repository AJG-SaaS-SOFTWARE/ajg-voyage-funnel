# Liens UTM — lancement V1

Base : `https://voyage.ajgsolutionsgroup.com/`

## Liens permanents par canal

| Canal | URL |
| --- | --- |
| Instagram bio | https://voyage.ajgsolutionsgroup.com/instagram |
| Instagram Reel | https://voyage.ajgsolutionsgroup.com/?utm_source=instagram&utm_medium=social&utm_campaign=launch_v1&utm_content=reel |
| Instagram Story | https://voyage.ajgsolutionsgroup.com/?utm_source=instagram&utm_medium=social&utm_campaign=launch_v1&utm_content=story |
| Facebook | https://voyage.ajgsolutionsgroup.com/?utm_source=facebook&utm_medium=social&utm_campaign=launch_v1 |
| TikTok bio | https://voyage.ajgsolutionsgroup.com/?utm_source=tiktok&utm_medium=social&utm_campaign=launch_v1&utm_content=bio |
| TikTok vidéo | https://voyage.ajgsolutionsgroup.com/?utm_source=tiktok&utm_medium=social&utm_campaign=launch_v1&utm_content=video |
| LinkedIn | https://voyage.ajgsolutionsgroup.com/?utm_source=linkedin&utm_medium=social&utm_campaign=launch_v1 |
| WhatsApp Status | https://voyage.ajgsolutionsgroup.com/?utm_source=whatsapp&utm_medium=status&utm_campaign=launch_v1 |
| Message demandé | https://voyage.ajgsolutionsgroup.com/?utm_source=whatsapp&utm_medium=direct_requested&utm_campaign=launch_v1 |
| QR code | https://voyage.ajgsolutionsgroup.com/?utm_source=qr&utm_medium=offline&utm_campaign=launch_v1 |

## Convention pour les contenus

Pour différencier les créations, remplacer `utm_content` par un identifiant court :

- `hotel_compare`
- `club_voyage`
- `faq_prix`
- `travel_business`
- `presentation_30min`
- `voyageur_frequent`

Exemple :

`https://voyage.ajgsolutionsgroup.com/?utm_source=instagram&utm_medium=social&utm_campaign=launch_v1&utm_content=hotel_compare`

## Règles

- minuscules uniquement ;
- pas d’espace ni d’accent ;
- une campagne = une logique de nommage ;
- ne pas modifier les anciennes balises après publication ;
- noter le contenu exact associé à chaque `utm_content`.


## Lien intelligent Instagram

`https://voyage.ajgsolutionsgroup.com/instagram` est le lien permanent recommandé pour la bio Instagram.

- priorité à la langue choisie précédemment par le visiteur ;
- sinon détection de la langue principale du navigateur ;
- français → accueil FR ;
- toute autre langue → accueil EN ;
- attribution ajoutée automatiquement : `utm_source=instagram`, `utm_medium=social`, `utm_campaign=instagram_profile`, `utm_content=bio` ;
- les paramètres UTM déjà présents dans l'URL sont conservés et ne sont pas écrasés ;
- aucune géolocalisation ni adresse IP n'est utilisée.

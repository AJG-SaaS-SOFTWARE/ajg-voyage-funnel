# Modèle de données prévu

## users
- id
- email
- role: member | admin
- created_at

## sites
- id
- owner_id
- slug
- status: draft | published | suspended
- primary_language
- enabled_languages
- brand_name
- first_name
- last_name
- hero_title
- hero_subtitle
- about_text
- booking_label
- booking_url
- instagram_url
- facebook_url
- show_travel_journals
- compliance_profile
- created_at
- updated_at

## media
- id
- site_id
- type: image | video
- storage_path
- alt_text
- sort_order

## travel_journals
- id
- site_id
- slug
- title
- excerpt
- body
- cover_media_id
- published_at

## domains
- id
- site_id
- hostname
- kind: managed_subdomain | custom_domain
- verification_status
- is_primary

## subscriptions
- id
- site_id
- plan
- status
- current_period_end

Principe : le rendu public ne contient pas de logique métier dupliquée par client. Le hostname résout vers le site correspondant et le template lit uniquement la configuration de ce site.
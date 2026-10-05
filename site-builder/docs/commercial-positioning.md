# ELTARA — positionnement commercial et gamme cible

Dernière mise à jour : 29 septembre 2026.

## Positionnement

ELTARA n'est pas commercialisé comme « un constructeur de sites moins cher ».

La proposition de valeur est :

> **Décrivez votre activité. ELTARA la transforme en une présence digitale professionnelle, structurée pour être visible, crédible et prête à évoluer.**

Formulation courte recommandée :

> **Élevez votre présence digitale. Votre site commence par votre activité, pas par un template.**

Le produit distingue deux niveaux d'assistance :

- **IA rédactionnelle** : rédaction, reformulation, amélioration et suggestions dans les champs où elle apporte une vraie valeur ;
- **Concepteur IA / AI Site Architect** : brief, stratégie, architecture, proposition de sections, premiers contenus et raffinement, tout en gardant chaque élément modifiable.

## Offres publiques retenues

### Essentiel — 15 € / mois ou 150 € / an

Objectif : fournir le **RUN** du site avec un coût lisible et une expérience largement self-service.

- 1 site professionnel ;
- hébergement et publication ;
- domaine personnalisé ;
- éditeur complet ;
- personnalisation et responsive ;
- sauvegardes ;
- SEO essentiel ;
- analytics essentiels ;
- IA rédactionnelle légère ;
- Quality Check ;
- facturation, domaine, export et récupération en self-service.

Essentiel ne comprend pas le pilotage continu du site par l'AI Website Manager.

### Création IA complète — 49 € une fois

Objectif : vendre **BUILD** comme une prestation automatisée distincte de l'abonnement.

Le Concepteur IA réalise une première version complète du site à partir du brief client :

- diagnostic du besoin ;
- stratégie ;
- architecture ;
- pages ;
- direction visuelle ;
- textes ;
- CTA ;
- modules pertinents ;
- audits qualité ;
- raffinement automatique ;
- proposition modifiable avant publication.

Le paiement est ponctuel. Une fois le site créé, le client peut rester simplement sur Essentiel.

### Growth — 29 € / mois ou 290 € / an

Objectif : vendre **GROW**, c'est-à-dire le pilotage continu et l'amélioration du site, et non l'accès ponctuel à un générateur.

- tout Essentiel ;
- AI Website Manager ;
- diagnostics continus ;
- interprétation des analytics ;
- recommandations SEO/AEO ;
- recommandations conversion / CTA ;
- détection d'erreurs et d'opportunités ;
- création de nouvelles pages/campagnes ;
- adaptation du site à une nouvelle offre ou cible ;
- capacité IA supérieure ;
- synthèses et priorités d'action.

Hypothèse commerciale retenue :

- Création IA : +49 € pour Essentiel mensuel ou annuel ;
- Création IA : +49 € pour Growth mensuel ;
- Création IA offerte avec Growth annuel à 290 €, sous réserve de validation du coût réel moyen pendant la bêta.

Les limites exactes d'IA, stockage et trafic seront définies sur la base des données de consommation réelles et resteront pilotables côté serveur.

## Essai commercial

La logique d'essai doit être réévaluée avec la nouvelle architecture BUILD / RUN / GROW.

Le principe retenu est désormais :

- la Création IA est une prestation ponctuelle et ne doit pas être obtenue artificiellement en prenant Growth un seul mois ;
- Essentiel et Growth doivent pouvoir être testés sans contourner le prix de BUILD ;
- Growth doit être conservé pour la valeur récurrente de l'AI Website Manager ;
- les Beta Testers continuent à bénéficier de l'accès complet hors Stripe.

Pendant la bêta actuelle, Stripe live reste désactivé et aucun paiement commercial n'est ouvert.

## Beta Tester

Les proches invités à la bêta ne sont pas des clients payants.

Le statut **Beta Tester** :

- est attribué par un administrateur ;
- donne temporairement l'équivalent fonctionnel complet de Growth ;
- ne crée aucun Customer/Subscription Stripe ;
- expire automatiquement à la date enregistrée ;
- revient ensuite aux droits réels du compte, sans supprimer le site ;
- peut être renouvelé ou retiré manuellement ;
- reste absent de la grille tarifaire publique.

Durée administrable : 1 à 90 jours ; valeur proposée par défaut dans l'interface : **30 jours**.

## Pages produit

- /tarifs : page publique française ;
- /pricing : page publique anglaise ;
- /plans : page « Mon offre » de l'espace compte, synchronisée avec la grille commerciale ;
- /billing : état de facturation et récupération.

## Ce que l'on vend réellement

À éviter : « un autre website builder » ou « moins cher que X ».

À vendre : **un chemin guidé vers un site publiable**, avec moins de page blanche, moins d'hésitation et une progression claire :

> Brief → proposition → personnalisation → validation → publication.

L'IA accélère la conception ; l'utilisateur garde le contrôle.

## Règles de mise sur le marché

- Le programme Beta n'est pas un plan gratuit permanent.
- Le prix n'est pas le principal argument de vente : la valeur vient de la réduction de complexité et du temps gagné.
- Les quotas IA doivent rester pilotables côté serveur.
- Les fonctions IA payantes suivent la politique AJG d'impayés et sont protégées côté serveur.
- Les prix, les CGV/CGU, Stripe et les entitlements doivent être synchronisés avant ouverture des paiements live.


## Catalogue Stripe sandbox

Le catalogue Stripe sandbox actuel doit être **migré** vers le nouveau modèle avant tout test commercial final.

Cible :

- Essentiel mensuel : 15 € ;
- Essentiel annuel : 150 € ;
- Growth mensuel : 29 € ;
- Growth annuel : 290 € ;
- Création IA complète : 49 € en paiement unique.

Le navigateur ne transmet jamais de Price ID Stripe. Il transmet uniquement une intention autorisée ; le serveur résout le produit/prix correspondant.

L'achat de Création IA doit créer un droit ponctuel séparé de l'abonnement récurrent. Growth annuel pourra déclencher ce droit sans paiement supplémentaire lorsque l'offre promotionnelle "Création IA offerte" est activée.

Un interrupteur serveur `AJG_BILLING_CHECKOUT_ENABLED` reste obligatoire pour ouvrir Checkout. Sa valeur par défaut demeure `false`.

## Cadre juridique de pré-lancement

Les routes publiques suivantes sont préparées en français et en anglais :

- `/mentions-legales` / `/legal` ;
- `/confidentialite` / `/privacy` ;
- `/cgv` / `/terms` ;
- `/resilier` / `/cancel`.

Elles ne doivent jamais inventer les informations du vendeur. Tant que l’identité juridique finale n’est pas renseignée, elles indiquent explicitement leur statut de préparation et restent `noindex`.

La validation commerciale utilise deux niveaux de sécurité complémentaires :

1. complétude technique des champs vendeur obligatoires ;
2. validation humaine explicite via `AJG_COMMERCIAL_LEGAL_READY=true`.

La vente aux consommateurs est désactivée par défaut avec `AJG_COMMERCIAL_CONSUMER_SALES_ENABLED=false`. Elle ne doit être activée qu’après mise en place du parcours de rétractation, de la résiliation électronique, des informations précontractuelles B2C et du médiateur de la consommation compétent.

La politique de confidentialité distingue les traitements propres à ELTARA (compte, facturation, sécurité, support, pilotage produit) des cas où AJG peut traiter du contenu ou des données de visiteurs pour le compte du client qui publie son site.

## Gates restant nécessaires avant Stripe live

- identité juridique réelle du vendeur ;
- CGS/Confidentialité relues sur cette identité ;
- régime TVA et traitement fiscal confirmés ;
- informations Stripe live et secret webhook live ;
- médiateur + parcours consommateur uniquement si la vente B2C est activée ;
- activation finale et volontaire de `AJG_BILLING_CHECKOUT_ENABLED`.


## Stratégie fiscale de lancement

Le lancement initial est préparé en **B2B**, cohérent avec la cible indépendants / petites entreprises et avec la désactivation actuelle de la vente aux consommateurs.

Les produits Stripe sandbox Essentiel et Growth utilisent le Product Tax Code officiel **Software as a Service (SaaS) - Business Use** (`txcd_10103001`).

Checkout collecte :
- l’adresse de facturation ;
- le numéro fiscal/TVA lorsqu’il est pris en charge ;
- le plan et la périodicité choisis.

Le calcul automatique de taxe n’est jamais activé par défaut. Le runtime distingue deux régimes possibles à confirmer avant lancement :

- `AJG_VAT_REGIME=franchise_base` : Stripe Tax doit rester désactivé ;
- `AJG_VAT_REGIME=vat_registered` : le numéro de TVA du vendeur doit être renseigné et Stripe Tax doit être explicitement activé.

`AJG_VAT_REGIME=unconfirmed` reste la valeur sûre tant que la situation fiscale réelle du vendeur n’est pas établie. Le gate commercial refuse alors l’ouverture des paiements.


## Architecture BUILD / RUN / GROW

La roadmap détaillée de mise en œuvre est versionnée dans :

`site-builder/docs/build-run-grow-roadmap.md`

Objectif : maximiser le self-service et automatiser le diagnostic, le support, le contrôle des coûts et la remédiation technique afin que le run humain AJG reste exceptionnel.

# AJG Site Builder — positionnement commercial et gamme cible

Dernière mise à jour : 29 septembre 2026.

## Positionnement

AJG Site Builder n'est pas commercialisé comme « un constructeur de sites moins cher ».

La proposition de valeur est :

> **Décrivez votre activité. AJG Builder vous aide à structurer, rédiger, personnaliser et publier un site professionnel — sans partir d'une page blanche.**

Formulation courte recommandée :

> **Votre site ne commence pas par un template. Il commence par votre activité.**

Le produit distingue deux niveaux d'assistance :

- **IA rédactionnelle** : rédaction, reformulation, amélioration et suggestions dans les champs où elle apporte une vraie valeur ;
- **Concepteur IA / AI Site Architect** : brief, stratégie, architecture, proposition de sections, premiers contenus et raffinement, tout en gardant chaque élément modifiable.

## Offres publiques retenues

### Essentiel — 19 € / mois ou 190 € / an

Objectif : permettre à un indépendant ou une petite entreprise de construire et gérer son site avec une aide IA continue, sans automatiser toute la conception.

- 1 site professionnel ;
- hébergement et publication inclus ;
- domaine personnalisé ;
- éditeur, personnalisation et design responsive ;
- IA rédactionnelle dans les champs utiles ;
- réécriture, amélioration et suggestions de contenu ;
- SEO essentiel ;
- sans Concepteur IA complet.

### Pro IA — 39 € / mois ou 390 € / an

Objectif : accélérer fortement le passage du brief à une première version structurée.

- tout Essentiel ;
- Concepteur IA de site ;
- proposition de structure et de sections à partir du brief ;
- premiers textes générés puis entièrement éditables ;
- aide IA renforcée pour les itérations ;
- quota IA supérieur ;
- capacité média et stockage supérieure ;
- accès prioritaire aux nouveaux modules IA.

Les limites exactes de générations IA et de stockage seront affichées avant activation de la facturation. Les quotas techniques actuels de bêta ne constituent pas une promesse commerciale définitive.

## Essai commercial

Au lancement commercial :

- **14 jours d'expérience Pro IA** ;
- aucun droit payant n'est ouvert sans paiement confirmé à la fin de l'essai ;
- l'utilisateur pourra ensuite choisir Essentiel ou Pro IA ;
- les contrôles d'accès IA restent appliqués côté serveur.

Pendant la bêta actuelle, Stripe reste désactivé et la page Tarifs indique explicitement que l'encaissement n'est pas encore ouvert.

## Beta Tester

Les proches invités à la bêta ne sont pas des clients payants.

Le statut **Beta Tester** :

- est attribué par un administrateur ;
- donne temporairement l'équivalent fonctionnel complet de Pro IA ;
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

Le catalogue de test reprend exactement la grille commerciale publique :

- Essentiel mensuel : 19 € ;
- Essentiel annuel : 190 € ;
- Pro IA mensuel : 39 € ;
- Pro IA annuel : 390 €.

Le navigateur ne transmet jamais de Price ID Stripe. Il transmet uniquement le plan et la périodicité autorisés ; le serveur les convertit vers les Price IDs configurés dans l’environnement.

Un interrupteur serveur `AJG_BILLING_CHECKOUT_ENABLED` doit être explicitement positionné à `true` pour ouvrir Checkout. Sa valeur par défaut reste `false`.

Pendant un abonnement Stripe au statut `trialing`, le plan cible est conservé en base mais les droits effectifs sont temporairement ceux de Pro IA pendant 14 jours. À la sortie du trial, les droits correspondent automatiquement au plan réellement souscrit.

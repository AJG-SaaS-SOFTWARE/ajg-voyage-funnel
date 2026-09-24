# AJG Site Builder — prototype

Objectif : transformer AJG Voyage en un modèle de site paramétrable, puis en SaaS multi-utilisateur.

## Prototype 0.1

Le prototype permet de :
- renseigner l'identité du membre ;
- choisir FR / EN / bilingue ;
- personnaliser le titre, l'introduction et la présentation ;
- renseigner un lien de réservation Calendly, Google ou autre ;
- préparer un sous-domaine ;
- activer ou non une section « Mes voyages » ;
- conserver un bloc conformité non modifiable ;
- prévisualiser le site en direct ;
- sauvegarder le brouillon localement ;
- exporter la configuration JSON.

## Architecture cible

1. Frontend et rendu public : Next.js sur Vercel.
2. Authentification, données et médias : Supabase.
3. Multi-tenant : un seul code source, un enregistrement site par membre.
4. Sous-domaines réseau : prenom.voyage.ajgsolutionsgroup.com.
5. Domaines personnalisés : option payante plus tard.
6. IA : couche facultative pour proposer des textes à partir du questionnaire.
7. Conformité : blocs légaux et mentions obligatoires verrouillés dans le template.

## Pourquoi un moteur multi-tenant

On ne clone pas un dépôt par membre. Un seul moteur coûte moins cher, se maintient plus facilement et permet de corriger tous les sites d'un coup. Chaque client possède uniquement sa configuration, ses médias et son domaine.

## Phases

### Phase A — bêta réseau
- wizard de création ;
- aperçu en direct ;
- sauvegarde Supabase ;
- upload photos ;
- publication sur sous-domaine ;
- un template AJG Voyage paramétrable.

### Phase B — produit commercial
- comptes clients ;
- abonnement ;
- domaines personnalisés ;
- modèles supplémentaires ;
- analytics ;
- génération assistée par IA ;
- back-office administrateur.

### Phase C — industrialisation
- onboarding automatisé ;
- facturation ;
- quotas stockage / IA ;
- gestion équipe / agence ;
- bibliothèque de blocs approuvés.

Le prototype est volontairement sans base de données : aucune ressource payante supplémentaire n'est créée à ce stade.
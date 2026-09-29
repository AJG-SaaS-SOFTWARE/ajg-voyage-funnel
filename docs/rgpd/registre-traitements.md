# Registre RGPD — AJG Voyage

Dernière revue : 26 septembre 2026  
Responsable du traitement : Alexandre Gallet

## Traitement 1 — Gestion des demandes de présentation et des prospects

**Finalités**
- répondre aux demandes envoyées via AJG Voyage ;
- personnaliser et organiser le suivi d’une demande de présentation ;
- mesurer la provenance des demandes ;
- envoyer des communications commerciales uniquement lorsque le consentement requis a été recueilli.

**Personnes concernées**  
Visiteurs qui remplissent volontairement le formulaire AJG Voyage.

**Données**
- prénom ;
- e-mail ;
- téléphone facultatif ;
- réponses au questionnaire ;
- langue ;
- consentement marketing et son état ;
- score interne calculé à partir des réponses ;
- paramètres UTM présents dans l’URL ;
- URL d’arrivée et URL référente transmise par le navigateur.

**Bases légales**
- réponse et suivi de la demande : intérêt légitime à traiter une demande volontairement adressée au site ;
- prospection commerciale B2C par e-mail, SMS et téléphone : consentement préalable ;
- sécurité et prévention des abus : intérêt légitime.

**Destinataires / sous-traitants**
- Alexandre Gallet ;
- Vercel, Inc. : hébergement du site et exécution de l’API de formulaire ;
- Supabase : stockage des demandes transmises via le formulaire ;
- Resend : envoi de la notification technique de nouvelle demande ;
- Calendly, LLC : uniquement lorsque la personne choisit d’ouvrir le service externe de réservation et y saisit des informations ;
- organisateur du rendez-vous concerné.

**Transferts internationaux**
Vercel et Resend réalisent notamment des traitements aux États-Unis ; Supabase peut recourir à des traitements internationaux selon la région et ses sous-traitants ; Calendly peut également impliquer des transferts internationaux. Vérifier périodiquement les mécanismes applicables de chaque prestataire (EU-U.S. Data Privacy Framework lorsqu’applicable, clauses contractuelles types et autres garanties prévues contractuellement).

**Conservation**
Données prospect : maximum 3 ans à compter de la collecte ou du dernier contact émanant du prospect. Le retrait du consentement met fin à l’utilisation des données pour la prospection. Une demande d’effacement peut conduire à une suppression anticipée, sauf obligation légale contraire.

**Décision automatisée**
Le score interne sert uniquement à organiser/personnaliser le suivi. Aucune décision produisant un effet juridique ou significatif n’est prise automatiquement.

**Mesures de sécurité**
HTTPS/HSTS, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, honeypot de formulaire. Maintenir MFA et contrôle d’accès sur les comptes d’administration utilisés.

## Traitement 2 — Préférence linguistique

**Finalité**  
Mémoriser la langue explicitement choisie par le visiteur.

**Donnée / support**  
Stockage local fonctionnel `ajg_language_preference` contenant uniquement `fr` ou `en`.

**Destinataire**  
AJG Voyage, localement dans le navigateur de l’utilisateur.

**Publicité / suivi intersites**  
Aucun.

## Revue périodique

À chaque ajout d’un formulaire, outil d’analyse, pixel, CRM, outil d’e-mailing, paiement, embed ou nouveau prestataire, mettre à jour ce registre et la notice de confidentialité avant ou au moment de la mise en production. Vérifier au minimum annuellement les durées de conservation, accès, sous-traitants et mécanismes de transfert.


## Mesure interne du funnel AJG Voyage

- **Finalité :** mesurer les étapes principales du parcours (début/fin questionnaire, demande envoyée, clic Calendly) afin d'améliorer le funnel.
- **Données :** identifiant aléatoire de session, événement, langue, chemin de page et UTM source/medium/campaign lorsqu'ils sont présents.
- **Exclusions :** aucun nom, email ou téléphone n'est enregistré dans la table d'événements ; pas de publicité ciblée ni de suivi intersites.
- **Stockage navigateur :** identifiant dans `sessionStorage`, limité à la session de navigation.
- **Destinataire / stockage :** Supabase, table `ajg_voyage_funnel_events`.
- **Revue :** contrôler périodiquement la durée de conservation et purger les événements devenus inutiles.

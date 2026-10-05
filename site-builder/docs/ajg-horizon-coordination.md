# Coordination AJG Horizon — périmètre actif

Décision utilisateur du 02/10/2026 : concentrer le développement sur **Wellness CRM et ELTARA**. ProspectFlow et le produit immobilier sont exclus du périmètre actif ; aucun chantier, migration, facturation ou reprise n'est engagé pour eux. Cette décision n'autorise aucune suppression de leurs données ou projets.

## Priorités coordonnées

1. Réconcilier code, web publié, composants Edge et configuration.
2. Valider les parcours de facturation Sandbox et le reporting privé du cockpit.
3. Conserver la séparation abonnement AJG / paiements des clients des praticiens.
4. Wellness : recherche universelle sur sa branche dédiée ; paiements et recherche ne se remplacent pas.
5. Builder : parcours self-service, UX et maîtrise des coûts BUILD/RUN/GROW.
6. Mettre à jour les guides et preuves de release avec chaque changement métier.

## Travail de coordination WOR-183

Harmonisation de la protection du reporting : token serveur de 32 caractères minimum, comparaison constante et tests négatifs. Wellness #208 ; Builder #199. Aucun changement de prix, essai, impayé, migration ou activation live.

## Points à réconcilier

- Wellness documente encore 30 jours d'essai ; une consigne transverse mentionne 14 jours. Signaler le conflit avant toute modification ; ne pas confondre essai et grâce après impayé.
- Builder et Voyage partagent un dépôt, mais leurs projets et releases restent distincts.
- Une fusion n'est pas une publication ; une fonction déployée n'est pas une activation commerciale.
- Le cockpit observe les produits ; chaque produit reste responsable des webhooks et droits côté serveur.

Avant toute release : SHA exact, CI requise, compatibilité des composants, revue sécurité si pertinente, preuve de publication et QA adaptée. Les validations déjà autorisées dans le chantier restent valables selon leur périmètre.

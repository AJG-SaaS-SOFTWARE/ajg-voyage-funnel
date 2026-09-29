# AJG Site Builder — registre de conservation des données

Dernière mise à jour : 29 septembre 2026.

Ce document fixe les règles de conservation applicables au Builder avant activation commerciale de Stripe. Les durées sont définies par finalité ; aucune donnée personnelle n'est conservée indéfiniment par défaut.

## 1. Données de service AJG Builder

| Catégorie | Base / finalité | Durée en base active | Sort à l'effacement |
|---|---|---|---|
| Compte Supabase Auth | Exécution du service et sécurité | Pendant la vie du compte | Supprimé après purge des dépendances lors d'une demande valide d'effacement du compte |
| Sites, brouillons, configuration, pages et modules | Exécution du service | Pendant la vie du site | Supprimés lors de la purge contrôlée du site ou du compte |
| Médias publics et privés | Exécution du service | Pendant la vie du site | Supprimés via les API Supabase Storage lors de la purge |
| Domaines et rattachements Vercel | Exécution du service | Pendant la vie du site / rattachement | Détachés puis supprimés lors de la purge |
| Messages de contact reçus par un site | Exécution du service du client | Tant que le site et le compte sont conservés, sous réserve de la politique propre du client | Supprimés avec le site lors de la purge |
| Données IA opérationnelles contenant ou référant du contenu du site | Fourniture de l'assistant | Pendant la vie utile au service | Supprimées lorsqu'elles sont site-scoped et que le site est purgé |
| Télémétrie IA sans prompt ni contenu client | Pilotage coût/qualité | Durée à définir séparément par finalité d'analyse ; aucune conservation illimitée | Doit être agrégée/anonymisée ou supprimée à l'échéance |

## 2. Demandes d'exercice des droits

Le journal RGPD conserve uniquement les éléments nécessaires à la traçabilité : portée de la demande, statut, dates et systèmes traités. Après purge, les références directes au compte et au site sont mises à `null` et aucun contenu du site n'est copié dans ce journal.

La CNIL rappelle qu'une durée doit être déterminée pour chaque traitement et qu'elle doit être justifiée par la finalité. La durée propre au journal de demandes AJG devra être revue périodiquement ; tant qu'une durée de preuve spécifique n'est pas adoptée, le journal doit rester pseudonymisé et ne pas contenir de contenu client.

## 3. Facturation et pièces comptables

Les données opérationnelles AJG liées à Stripe (Customer ID, Subscription ID, Price ID) sont supprimées de la base AJG lorsque le site/compte est purgé, dès lors qu'elles ne sont plus nécessaires au service.

En revanche, les pièces comptables et justificatives soumis à une obligation légale de conservation ne sont pas supprimés du système comptable ou du prestataire de paiement au seul motif de la suppression du compte.

Règles retenues pour AJG en France :

- factures client et fournisseur, bons de commande/livraison/réception et autres pièces justificatives comptables : **10 ans à compter de la clôture de l'exercice** ;
- livres et registres comptables : **10 ans à compter de la clôture de l'exercice** ;
- contrats et correspondances commerciales : **5 ans** lorsqu'ils sont nécessaires comme documents civils/commerciaux ;
- pièces relatives à la TVA et taxes sur le chiffre d'affaires : **6 ans** au titre du délai fiscal, sans réduire la durée de 10 ans déjà applicable aux factures conservées comme pièces comptables.

La conservation légale doit être réalisée en archivage intermédiaire ou dans le système comptable/Stripe approprié, avec accès limité. Elle ne justifie pas de conserver le contenu du site, ses médias, ses brouillons ou ses données marketing.

## 4. Stripe

Une demande d'effacement AJG :

1. annule l'abonnement Stripe concerné pour empêcher de nouvelles échéances ;
2. supprime les identifiants opérationnels Stripe de la base AJG avec le site/compte ;
3. ne tente pas d'effacer aveuglément les écritures, factures ou données que Stripe ou AJG doivent conserver pour une obligation légale, fiscale, comptable, de lutte contre la fraude ou de défense de droits.

Stripe indique également pouvoir conserver certaines données lorsque la législation applicable l'impose.

## 5. Références officielles

- CNIL — Les durées de conservation des données : https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees
- CNIL — Droit à l'effacement : https://www.cnil.fr/fr/comprendre-mes-droits/le-droit-leffacement-supprimer-vos-donnees-en-ligne
- Service Public Entreprendre — Délais de conservation des documents des entreprises : https://entreprendre.service-public.fr/vosdroits/F10029
- Stripe — Suppression des informations personnelles et limites légales : https://support.stripe.com/questions/i-would-like-to-delete-the-information-stripe-has-collected-from-me?locale=fr-FR

## 6. Revue

Ce registre doit être revu avant tout changement affectant :
- les données collectées ;
- les prestataires ou sous-traitants ;
- les traitements marketing/analytics ;
- la facturation ou la fiscalité ;
- les durées d'archivage ;
- les finalités déclarées aux utilisateurs.

# AJG Site Builder — effacement et purge contrôlée

Dernière mise à jour : 29 septembre 2026.

## Principe

Le moteur d'impayés et le droit à l'effacement sont deux mécanismes distincts.

- Un impayé, un non-renouvellement ou une carte expirée peut restreindre puis suspendre le service, mais ne déclenche jamais de suppression automatique.
- Une demande d'effacement explicite place le site ou le compte dans un état de confidentialité dédié, retire immédiatement le site du public et bloque les nouvelles mutations.
- La purge définitive est une opération administrative explicite, confirmée séparément et journalisée.

## Ordre de purge d'un site

1. Annuler l'abonnement Stripe actif correspondant, s'il existe.
2. Détacher les domaines du projet Vercel.
3. Supprimer les fichiers des buckets Supabase Storage via l'API Storage, jamais par suppression SQL des métadonnées.
4. Supprimer les traces applicatives site-scoped qui utilisent un `ON DELETE SET NULL`.
5. Supprimer la ligne `sites` ; les dépendances configurées en cascade sont alors supprimées.
6. Conserver dans la demande RGPD uniquement un journal technique pseudonymisé des systèmes traités et des dates.

La procédure est conçue pour être rejouable. Un échec laisse la demande en `processing` et le site reste suspendu.

## Suppression d'un compte

Pour une demande de compte, tous les sites sont purgés selon la procédure ci-dessus. Le compte Supabase Auth est ensuite bloqué puis supprimé côté serveur. La suppression de l'utilisateur détruit ses sessions/refresh tokens gérés par Supabase ; un access token déjà émis peut rester cryptographiquement valide jusqu'à son expiration, mais les données détenues par le compte ont été supprimées et les relations vers `auth.users` empêchent de recréer des lignes propriétaires pour un utilisateur inexistant.

## Données financières

Le Builder ne tente pas d'effacer automatiquement les écritures, factures ou autres pièces financières conservées chez Stripe lorsqu'elles relèvent d'une obligation légale ou d'un besoin de défense de droits. Il annule l'abonnement afin d'éviter de nouvelles échéances, puis dissocie la purge du contenu de la conservation financière.

Les durées précises de conservation des pièces financières ne sont pas codées dans l'application. Elles doivent être fixées et documentées dans le registre de conservation juridique/comptable applicable avant lancement commercial.

## Contrôles

- les RPC de demande d'effacement sont réservées au backend service-role ;
- la suppression directe d'un site par le rôle `authenticated` est interdite ;
- l'administration exige le rôle admin et la confirmation littérale `PURGER` ;
- le journal de demande ne stocke pas une copie des contenus supprimés ;
- les suppressions Storage utilisent l'API officielle et des lots de 1 000 objets maximum.

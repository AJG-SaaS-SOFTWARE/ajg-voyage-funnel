# Relance du diagnostic post-publication à vol unique

## Parcours couvert

Un double clic avant le prochain rendu React ne doit pas doubler le travail de récupération :

1. le premier clic acquiert un verrou local ;
2. une seule lecture de session Supabase est effectuée ;
3. une seule requête authentifiée de santé est envoyée ;
4. le verrou est libéré après succès, erreur ou échéance afin qu’une relance ultérieure reste possible.

Le verrou est limité à l’instance de page. Il ne modifie ni la session, ni Auth, ni les droits, ni les données. Il ne déclenche aucun rejeu automatique et ne remplace pas les protections serveur.

## Preuve

Le test comportemental extrait les gestionnaires réels du TSX. Deux appels concurrents doivent produire exactement une lecture de session et une requête, puis une relance séquentielle doit fonctionner après libération.

Limite : cette preuve CI ne constitue pas un parcours navigateur avec une boîte mail ordinaire autorisée.

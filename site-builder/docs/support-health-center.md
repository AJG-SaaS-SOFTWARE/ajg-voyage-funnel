# AJG Site Builder — Health Center & support tickets

Date : 30 septembre 2026.

## Objectif

Réduire le support humain en exécutant un diagnostic déterministe avant toute escalade AJG.

Le premier socle couvre :

- disponibilité du backend pendant la demande ;
- statut de publication et suspension publique ;
- état connu des domaines ;
- état de facturation ;\n- rendu HTTP réel du site publié sur l’origine Builder autorisée ;\n- fraîcheur de la sauvegarde externe ;\n- état des circuit breakers IA globaux ;
- ticket structuré avec diagnostic figé au moment de la demande ;
- action client proposée lorsque le problème est identifiable ;
- file d'administration séparant action client, incident et résolution.

Aucun LLM n'est utilisé pour ce diagnostic. Aucun mot de passe, clé API, donnée bancaire, contenu de site ou historique de navigation n'est collecté automatiquement.

## Sécurité

Les clients ne peuvent pas insérer ou modifier directement la table de tickets via la Data API. La création passe par l'API support, qui vérifie le JWT puis limite le diagnostic aux sites possédés par l'utilisateur. Les clients peuvent lire leurs tickets via RLS. L'administration passe par une API qui revérifie le rôle admin en base avant de créer le client service.

## États initiaux

- waiting_customer : une cause déterministe et une action client ont été identifiées sans incident technique ;
- diagnosed : diagnostic attaché et intervention AJG potentiellement nécessaire ;
- in_progress : traitement AJG ;
- resolved / closed : terminé.

## Limites de ce bloc

Le Health Center vérifie désormais le rendu public réel via l’origine Builder contrôlée, sans utiliser de hostname fourni par le client, ainsi que la fraîcheur de la sauvegarde externe et les circuit breakers IA. Il ne vérifie pas encore directement les domaines personnalisés par requête réseau, les formulaires, liens cassés, sitemap, latence détaillée ou erreurs runtime Vercel par site. Il ne déclenche aucune réparation automatique. Ces contrôles doivent être ajoutés progressivement et chaque auto-remédiation devra être sûre, idempotente, journalisée et réversible.


## Réconciliation autonome des demandes self-service

Les tickets au statut `waiting_customer` sont réévalués par la tâche quotidienne de sauvegarde déjà existante. Aucun cron supplémentaire n'est créé.

Règles :

- diagnostic redevenu sain : résolution automatique avec `auto_health_recovered` ;
- apparition d'un incident : escalade immédiate vers `diagnosed` avec sévérité haute ;
- action client toujours pertinente : maintien en self-service ;
- action client non résolue après 72 h : escalade AJG pour éviter un ticket bloqué indéfiniment ;
- état `action` sans action réellement exécutable par le client : escalade AJG.

La réconciliation ne lit ni le sujet ni le corps du ticket. Elle ne modifie que les tickets encore en `waiting_customer` au moment de l'UPDATE, afin qu'une intervention humaine concurrente ne puisse pas être écrasée.


Le client peut également relancer immédiatement le diagnostic d'un ticket `waiting_customer` après avoir appliqué l'action proposée. Le serveur revérifie l'identité, la propriété du ticket et son statut avant toute mise à jour. Le même moteur de décision que la réconciliation planifiée est utilisé : résolution si la cause a disparu, maintien self-service si l'action reste nécessaire, ou escalade AJG si un incident est désormais détecté.

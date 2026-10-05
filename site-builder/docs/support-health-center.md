# ELTARA — Health Center & support tickets

Date : 30 septembre 2026.

## Objectif

Réduire le support humain en exécutant un diagnostic déterministe avant toute escalade AJG.

Le premier socle couvre :

- disponibilité du backend pendant la demande ;
- statut de publication et suspension publique ;
- état connu des domaines ;
- état de facturation ;\n- rendu HTTP réel du site publié sur l’origine Builder autorisée ;
- latence du rendu public avec un seuil de diagnostic de 3,5 s ;
- présence d’une canonical HTTPS ;
- disponibilité et structure XML minimale du sitemap ;
- fraîcheur de la sauvegarde externe ;\n- état des circuit breakers IA globaux ;
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

Le Health Center vérifie désormais le rendu public réel via l’origine Builder contrôlée, sans utiliser de hostname fourni par le client, ainsi que la fraîcheur de la sauvegarde externe et les circuit breakers IA. Il ne contacte toujours pas directement les domaines personnalisés fournis par les clients : les sondes HTTP restent limitées à l’origine Builder contrôlée afin d’éviter un vecteur SSRF. Le Health Center vérifie désormais le sitemap, la canonical et une latence de rendu indicative. Il ne vérifie pas encore les formulaires de bout en bout, les liens cassés de chaque page ni les erreurs runtime Vercel attribuées à un site précis. Les seules réparations automatiques autorisées restent explicitement allowlistées, sûres, idempotentes, journalisées et réversibles ; le sous-domaine géré ELTARA constitue le premier cas couvert. Les autres contrôles doivent être ajoutés progressivement.


## Relance manuelle du diagnostic

Depuis le Health Center, le client dispose de **Diagnostiquer mon site** pour relancer immédiatement les contrôles techniques sans ouvrir de ticket. La relance réutilise la même route authentifiée et le même moteur déterministe que le chargement initial ; elle ne déclenche ni LLM ni mutation de contenu. Le résultat affiché est remplacé par le diagnostic le plus récent.

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


## Journal d'audit support

Le cycle de vie des demandes est journalisé dans `support_ticket_events` sans recopier le sujet ni le corps du ticket.

Événements couverts :

- création client ;
- nouveau diagnostic demandé par le client ;
- réconciliation automatique planifiée ;
- escalade ou résolution automatique ;
- changement de statut et résolution par l'administration.

Les métadonnées sont bornées à des primitives techniques courtes (statuts, catégorie, sévérité, diagnostic, code de résolution, âge du ticket). Les rôles navigateur restent en lecture seule ; seules les routes serveur privilégiées peuvent ajouter un événement. Une indisponibilité du journal ne provoque pas la répétition d'une action métier déjà réussie : elle est signalée côté serveur pour éviter la création de tickets ou de résolutions en double.


## Auto-remédiation technique sûre

Le premier mécanisme de correction automatique couvre uniquement le sous-domaine AJG géré par la plateforme.

Le client peut utiliser **Corriger automatiquement** lorsque le Health Center détecte que ce sous-domaine manque ou n'est pas encore vérifié. Le serveur :

- revérifie l'identité et la propriété du site ;
- refuse toute réparation si le site n'est pas publié ou si une demande d'effacement est active ;
- reconstruit uniquement le hostname AJG attendu à partir du slug et du domaine racine configuré ;
- ne modifie jamais automatiquement un domaine personnalisé ;
- ne remplace jamais un hostname géré incohérent : ce cas est escaladé ;
- conserve un domaine personnalisé vérifié comme domaine primaire ;
- journalise chaque tentative dans `support_remediation_runs` ;
- limite les répétitions rapprochées.

Cette première auto-remédiation est idempotente et ne touche à aucun texte, CTA, page ou choix graphique.


## Sweep quotidien de remédiation

La tâche quotidienne déjà utilisée pour la sauvegarde et la réconciliation support exécute aussi un sweep borné des sous-domaines AJG gérés. Aucun nouveau cron n'est ajouté.

Le sweep :

- analyse au maximum 50 sites publiés et actifs ;
- exclut tout site ayant un domaine personnalisé configuré ;
- ignore les états ambigus avec plusieurs sous-domaines AJG ;
- applique un cooldown de 6 heures après toute tentative ;
- répare au maximum 10 sites par exécution ;
- réutilise exactement le même moteur `runSupportRepair` et son journal d'audit ;
- traite les échecs d'une réparation individuelle comme un résultat observable, sans empêcher la sauvegarde quotidienne ;
- renvoie une erreur de cron uniquement si l'orchestration du sweep elle-même est indisponible.

Aucun LLM ni scan Premium n'est déclenché par ce sweep.


## KPI d'autonomie support

La vue `/admin/support` calcule désormais une fenêtre glissante de 30 jours, sans LLM, à partir des tickets et journaux déjà collectés.

Définitions :

- **clients actifs** : propriétaires distincts d'au moins un site publié dont l'état privacy est actif ;
- **tickets créés** : tickets ouverts pendant la fenêtre ;
- **tickets escaladés AJG** : tickets ayant atteint `diagnosed` ou `in_progress` pendant la fenêtre ;
- **tickets touchés par un admin** : tickets avec au moins un événement `actor_type=admin` pendant la fenêtre ;
- **résolus sans admin** : tickets de la cohorte créée sur 30 jours terminés sans événement admin ;
- **escalades / client actif** : indicateur suivi face à l'objectif initial inférieur à 0,15 par mois ;
- **remédiations** : tentatives, succès, échecs et codes de résultat issus de `support_remediation_runs`.

Les compteurs utilisent des identifiants dédupliqués : plusieurs diagnostics ou changements d'état d'un même ticket ne gonflent pas artificiellement le nombre de demandes humaines.

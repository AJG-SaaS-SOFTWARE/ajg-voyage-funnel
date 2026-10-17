# Résolution automatique après réparation du domaine primaire

Le POST client de réparation peut maintenant résoudre son ticket lié, sans
appel administrateur, uniquement pour `managed_domain_primary_repaired` réussi,
vérifié et audité. Le snapshot du ticket est lu côté serveur avant réparation :
propriétaire, site, catégorie domaine, statut diagnosed/waiting_customer et version.
Le nouveau diagnostic doit confirmer backend, rendu public et domaine sains,
sans contrôle contradictoire, et la disparition de la cause technique observée.
Sans ticket explicitement choisi, le Health Center utilise le même endpoint :
le serveur ne lie qu'une unique demande domaine non terminale du propriétaire
et du site (lecture bornée à deux candidats). Zéro demande, ambiguïté ou erreur
de lecture permet la réparation sans résolution automatique d'un ticket.

La fonction SQL réservée à service_role recontrôle propriétaire/version/statut,
site publié actif et accessible, domaine géré unique vérifié/primaire et absence
de domaine personnalisé. Elle exige un audit de réparation lié au même ticket,
site et propriétaire, postérieur à la version examinée. Elle écrit le statut
resolved et son événement système dans une même transaction, avec référence
exacte de réparation et versions avant/après. Elle ne généralise pas le RPC de
réconciliation horaire existant.
La version après écriture vient de `UPDATE ... RETURNING updated_at`, après
application du trigger existant, et non de l'horloge applicative.

Le serveur relit indépendamment le ticket et l'événement exact, y compris leurs
identités, code de résolution, référence de réparation et timestamps, avant
de retourner `ticketResolution.resolved/audited:true`. Un ACK perdu, une course
ou une preuve manquante retourne false sans réexécuter la résolution.

Le rendu public est vérifié par le serveur applicatif ; SQL ne fait aucun appel
HTTP. Les vérifications sont ponctuelles, pas une garantie permanente du domaine.
La recette structurelle client FR/EN exige cette résolution et son audit, sans
fallback opérateur. Elle continue de relire la demande centrale créée dans le
cockpit, mais ne prétend pas prouver sa résolution centrale :
`automaticProductResolutionVerified:true`, `centralResolutionVerified:false`,
`automaticClosureVerified:false`.

Aucun appel IA ni mutation DNS n'est ajouté. Les autres réparations, demandes,
catégories, états terminaux et domaines personnalisés restent hors de ce chemin.
Les fixtures SQL sont synthétiques, avec droits internal-e2e temporaires, et
annulées par ROLLBACK ; elles ne prouvent aucun paiement fournisseur réel.

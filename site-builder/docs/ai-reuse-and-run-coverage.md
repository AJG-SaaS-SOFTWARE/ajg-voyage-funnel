# Réutilisation IA et couverture du Run

## Réutilisation de stratégie

Le Concepteur conserve son analyse de stratégie lorsqu’une variante porte sur le même contexte. Le serveur signe la stratégie retournée avec un jeton opaque lié au propriétaire, au site, aux informations de création et au modèle auxiliaire. Le navigateur transmet ce jeton avec la stratégie précédente.

La signature expire après deux heures. Un jeton absent, expiré ou altéré, un autre propriétaire/site, un brief, une langue, un média ou une stratégie différents font exécuter une nouvelle analyse. Aucun jeton ne dispense des contrôles de droits, quotas ou budget. La proposition générée reste soumise aux contrôles déterministes, à la critique et au contrôle final indépendant.

La signature n’est pas envoyée au fournisseur IA et ne contient aucune donnée client lisible. Elle ne certifie pas une satisfaction humaine : elle prouve seulement l’intégrité et le contexte de la stratégie précédemment retournée par le serveur. Aucun modèle ni seuil qualité n’est remplacé dans ce lot.

## Contrôles Run tournants

Les contrôles de sites et de tickets en attente comptent leur population admissible puis sélectionnent une fenêtre horaire de 50 éléments. L’ordre est stable : identifiant pour les sites ; date de création puis identifiant pour les tickets. Les réparations restent limitées à 10 par passage et conservent leur temporisation de six heures.

L’ordre des sites candidats aux réparations tourne aussi de 10 positions à chaque nouveau cycle complet, avant le filtrage des droits et de la temporisation. Des erreurs persistantes en début de lot ne peuvent ainsi monopoliser les tentatives. Un test avec 151 sites durablement en échec et le cooldown réel vérifie que chaque candidat est tenté sur cinq cycles de fenêtres, sans dépasser les plafonds. Ce résultat sur population synthétique stable ne constitue pas un SLA de résolution.

Avec une population stable et une exécution chaque heure, les `ceil(nombre / 50)` fenêtres successives couvrent toute la population. L’ajout, la suppression ou le changement de statut d’éléments peuvent déplacer les fenêtres ; le calcul ne garantit donc pas un SLA ni une couverture réelle si des exécutions sont manquées. Un compte indisponible bloque le passage au lieu de prétendre que la file est vide.

Chaque passage conserve le cache de diagnostic par propriétaire/site : plusieurs tickets du même site nécessitent un seul diagnostic dans ce passage. Les mises à jour sont liées au propriétaire et au statut encore en attente, pour protéger les changements simultanés du support.

La réconciliation transporte de nouveau catégorie, diagnostic précédent et contrôles actuels vers la politique de récupération vérifiée. Les bugs, demandes génériques, données et litiges ne sont pas fermés à partir de la seule santé générale. Une réparation annoncée réussie sans confirmation ou journalisation est comptée comme un échec visible.

Le Run n’ajoute aucun appel IA fournisseur. Il ajoute deux lectures de comptage par cycle pour sortir de la limitation aux 50 premières lignes. Les tests utilisent le vrai SDK avec un transport HTTP synthétique pour vérifier pagination, filtres, cache et contrôle de concurrence ; aucune migration de schéma n’est nécessaire.

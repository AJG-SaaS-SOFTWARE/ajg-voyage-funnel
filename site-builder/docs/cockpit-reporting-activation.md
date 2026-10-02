# WOR-185 — connexion privée Builder / Cockpit

Le secret est généré par `randomBytes(32)` et stocké chiffré dans Vercel, uniquement en production.

- Builder : `AJG_COCKPIT_REPORTING_TOKEN`.
- Cockpit : `AJG_BUILDER_COCKPIT_REPORTING_TOKEN`.
- Le token Wellness existant n'est jamais modifié.

Le workflow `Provision private Builder Cockpit reporting` lit les deux configurations avant écriture, réutilise un token valide existant, crée uniquement les variables absentes et vérifie leur correspondance. Aucun upsert, rotation, suppression, secret dans les logs ou artifact. Un conflit ou une impossibilité de lecture bloque l'opération. Si une seule création réussit avant interruption, une relance reprend le même token.

La fusion du workflow sur main lance le provisionnement autorisé dans WOR-185. Le token Vercel doit avoir accès aux deux projets. Redéployer ensuite les versions validées des deux applications pour prendre en compte les variables.

Preuves de sortie : reporting Builder authentifié200, requêtes absentes/incorrectes401, Cockpit affiche source datée et mode test/live. Les agrégats produits ne s'ajoutent pas au total Stripe ; aucune activation Stripe live.

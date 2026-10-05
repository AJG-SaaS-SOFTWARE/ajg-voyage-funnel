# Sauvegarde externe des médias — ELTARA

## Objectif

Les sauvegardes PostgreSQL Supabase ne constituent pas une sauvegarde complète des objets stockés dans Supabase Storage. Le Builder maintient donc une copie privée hors Supabase des buckets :

- `site-media` ;
- `site-private-media`.

La cible prévue est un **Vercel Blob privé** connecté uniquement au projet `ajg-site-builder`.

## Principe

Le cron `/api/cron/storage-backup` s’exécute quotidiennement.

Pour chaque objet Storage :

1. le Builder lit ses métadonnées ;
2. si l’objet est inchangé depuis la dernière sauvegarde, aucun téléchargement ni nouvel upload n’est effectué ;
3. si l’objet est nouveau ou modifié, il est téléchargé côté serveur ;
4. un SHA-256 est calculé ;
5. une version immuable est copiée dans le Blob privé ;
6. un manifeste privé et un état courant sont enregistrés.

Les anciennes versions sont conservées pendant **35 jours** par défaut. Lorsqu’un objet disparaît de Supabase Storage, il est marqué comme supprimé dans l’état de sauvegarde puis vieillit jusqu’à l’expiration de cette fenêtre. Cela permet de récupérer une suppression accidentelle sans recopier tous les fichiers chaque jour.

## Sécurité

- Le store est privé.
- Les secrets restent côté serveur.
- En production Vercel, le flux privilégie l’OIDC du projet et n’exige pas de token Blob longue durée.
- Le endpoint cron exige `Authorization: Bearer <CRON_SECRET>`.
- `/api/health/storage-backup` n’expose ni nom de fichier, ni identifiant utilisateur, ni URL Blob ; il expose uniquement l’état, l’âge de la dernière sauvegarde, le nombre d’objets et la rétention.

## Activation production

1. Dans Vercel, créer un store Blob **Private** nommé par exemple `ajg-site-builder-backups`.
2. Le connecter au projet `ajg-site-builder`, environnement **Production**.
3. Vérifier que Vercel a ajouté `BLOB_STORE_ID`.
4. Redéployer la production.
5. Appeler une première fois le cron avec le `CRON_SECRET` ou attendre le prochain passage quotidien.
6. Vérifier `/api/health/storage-backup` puis le contrôle « Sauvegarde externe · fraîcheur » dans le back-office admin.

Aucun `BLOB_READ_WRITE_TOKEN` longue durée n’est nécessaire en production lorsque l’OIDC Vercel fonctionne.

## Seuils de fraîcheur

- jusqu’à 36 h : sain ;
- de 36 h à 72 h : à surveiller ;
- plus de 72 h : critique pour une mise en production commerciale.

## Restauration

Une restauration ne doit pas être automatique.

Procédure :

1. confirmer l’incident et identifier les objets réellement manquants ;
2. vérifier le manifeste de sauvegarde ;
3. choisir la version à restaurer ;
4. restaurer d’abord vers un emplacement temporaire ou un site de test ;
5. vérifier type MIME, taille et intégrité fonctionnelle ;
6. seulement ensuite restaurer vers le chemin de production ;
7. relancer le test Storage E2E et les smoke tests du site concerné.

Ne jamais restaurer en masse un snapshot historique sans tenir compte des suppressions enregistrées après ce snapshot.

## RGPD et suppressions

Les copies de sauvegarde sont isolées, privées et soumises à une rétention courte. Une suppression côté production est détectée au prochain cycle et la copie de récupération vieillit ensuite jusqu’à expiration de la fenêtre de rétention.

Le processus de restauration doit exclure toute donnée marquée supprimée. Lors d’une demande d’effacement exécutée par le workflow RGPD du Builder, les versions Blob, l’état courant et les snapshots contenant le site sont purgés immédiatement lorsque le store est configuré. La demande n’est pas déclarée terminée si cette étape échoue.

## Supervision

Le Cockpit Infrastructure AJG doit surveiller :

- présence du store ;
- date de la dernière sauvegarde réussie ;
- âge de la sauvegarde ;
- dérive vers >36 h / >72 h ;
- erreurs du cron ;
- volume et coût du store.

La sauvegarde doit rester hors du même fournisseur de stockage primaire : Supabase reste la source active, Vercel Blob sert de copie de récupération.

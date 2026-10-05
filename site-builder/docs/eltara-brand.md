# ELTARA — identité de marque

Dernière mise à jour : 5 octobre 2026.

## Architecture de marque

**ELTARA** est la marque produit du constructeur de présence digitale d’AJG Horizon.

Forme principale :

> **ELTARA**  
> *by AJG Horizon*

La signature `by AJG Horizon` exprime la filiation de marque. Elle reste secondaire par rapport au nom ELTARA.

## Promesse

Signature marketing française :

> **Élevez votre présence digitale.**

Signature marketing anglaise :

> **Elevate your digital presence.**

ELTARA n’est pas positionné comme « un website builder moins cher ». La promesse porte sur le résultat client : transformer une activité en présence digitale professionnelle, visible, crédible et capable d’évoluer.

## Storytelling

ELTARA est un nom de marque construit autour de l’idée d’élévation, de visibilité et de progression.

Le produit accompagne la trajectoire :

**activité → structure → site → visibilité → acquisition → croissance**

Le symbole associe :
- une étoile : visibilité, distinction, rayonnement ;
- une trajectoire/flèche ascendante : élévation et croissance ;
- des points/nœuds : technologie, connexion et structure digitale.

## Système visuel

Palette produit de référence :

- Indigo profond : `#432B86`
- Violet : `#5635B2`
- Bleu : `#4E79D8`
- Cyan : `#62D8EF`
- Glace : `#EAF8FC`
- Lilas : `#F0EDFF`

Gradient principal :

`#5635B2 → #4E79D8 → #62D8EF`

Le chrome du produit peut utiliser cette palette. Les sites créés par les clients conservent leur propre palette et ne doivent pas hériter de la marque ELTARA.

### Direction iconographique

- privilégier les formes abstraites, interfaces, trajectoires, étoiles et signes d’élévation liés à ELTARA ;
- utiliser le gradient indigo → bleu → cyan comme repère de marque ;
- éviter les photos de voyage, paysages ou lifestyle génériques pour représenter le produit lui-même ;
- réserver la photographie aux contenus et sites des clients, pas à l’identité ELTARA.

## Déclinaisons

1. **Logo marketing** : symbole + ELTARA + « Élevez votre présence digitale ».
2. **Logo corporate** : symbole + ELTARA + « by AJG Horizon ».
3. **Logo produit** : symbole + ELTARA.
4. **Icône compacte** : symbole seul pour favicon, PWA, sidebar et petits espaces.

Dans le produit, privilégier ELTARA seul ou ELTARA + contexte fonctionnel. Ne pas répéter le slogan marketing dans tous les écrans.

## Ton

ELTARA doit être :
- clair ;
- premium sans être ostentatoire ;
- moderne sans jargon IA inutile ;
- rassurant pour un indépendant ou une petite entreprise ;
- orienté résultat plutôt que fonctionnalités.

## Messages prioritaires

À privilégier :
- « Élevez votre présence digitale. »
- « Votre site commence par votre activité, pas par un template. »
- « Décrivez votre activité. ELTARA la transforme en une présence digitale professionnelle. »
- « Créez, publiez et faites évoluer votre présence digitale depuis un même espace. »

À éviter :
- « un autre website builder » ;
- « le moins cher » ;
- « site généré en un clic » si le parcours réel implique validation et personnalisation ;
- les promesses d’autonomie totale non vérifiées.

## Compatibilité avec AJG Horizon

ELTARA reste une marque produit autonome. AJG Horizon apparaît prioritairement :
- sur les supports corporate ;
- dans le footer ou les mentions légales ;
- sur les présentations commerciales ;
- dans les métadonnées de marque ;
- dans les communications groupe.

Dans l’interface quotidienne, la marque dominante est **ELTARA**.

## Domaines publiés

Depuis le 5 octobre 2026, le root de publication géré d’ELTARA est :

`*.eltara.ajgsolutionsgroup.com`

Règles de migration :

- les **nouveaux sites** reçoivent un sous-domaine `slug.eltara.ajgsolutionsgroup.com` ;
- les anciens `slug.voyage.ajgsolutionsgroup.com` restent supportés et ne sont pas réécrits automatiquement ;
- le middleware reconnaît les deux roots pendant la période de transition ;
- la réparation automatique des domaines conserve un hostname historique valide au lieu de le remplacer ;
- Vercel porte le wildcard `*.eltara.ajgsolutionsgroup.com` sur le projet ELTARA ;
- un retour temporaire au root historique reste possible en rebasculant `NEXT_PUBLIC_PUBLISHED_ROOT_DOMAIN` sans supprimer la compatibilité legacy.

Cette migration ne modifie pas les domaines personnalisés possédés par les clients.

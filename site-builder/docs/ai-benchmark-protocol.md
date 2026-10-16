# Évaluer la qualité et le coût IA

Comparer séparément assistance Essentiel, diagnostic Growth, section Growth et Création IA complète. Une différence de portée ne doit pas dégrader l'exactitude des faits.

Utiliser les mêmes briefs synthétiques pour chaque candidat. Cacher le candidat aux évaluateurs humains. Noter exactitude, respect de la demande, utilité et clarté ; ajouter une revue visuelle à la création complète. Ne pas remplacer une revue humaine par un score généré par le modèle.

Les seuils actuels du rapport sont des critères internes proposés : faits et demande respectés, utilité et clarté au moins 4/5. Ils ne prouvent pas une satisfaction de 98 %. La couverture des cas, les volumes et la qualité visuelle restent à valider avant changement de routage.

Une ligne par tentative, incluant les échecs et réparations dans le coût et la durée cumulés :

```json
{
  "candidate": "baseline",
  "caseId": "fr-assistance-brief-court-v1",
  "task": "assistance",
  "estimatedUsdMicros": 100,
  "uncertainCeilingUsdMicros": 0,
  "durationMs": 1000,
  "review": { "reviewer": "human", "factual": true, "followsRequest": true, "usefulness": 4, "clarity": 5 }
}
```

Ce JSON est un exemple fictif de format, pas une mesure de coût réel. `review: null` signifie non évalué. Un coût inconnu reste null. Une provision fournisseur incertaine est séparée ; elle interdit une comparaison définitive de coût. Les dépenses des tentatives rejetées restent dans le coût par résultat accepté.

Exécution sans appel fournisseur : `npm run benchmark:ai -- reviewed-attempts.json`. Le rapport indique la couverture des revues, les coûts inconnus et les médiane/P95 des durées. `comparisonReady` signifie que les mesures fournies sont complètes, pas que le nombre de cas est statistiquement suffisant ni qu'un candidat est approuvé.

Pour comparer les candidats d'une même tâche, fournir un `caseId` stable pour chaque brief et ses contraintes. Ne jamais réutiliser cet identifiant pour un brief modifié. `caseCoverageMatched` exige au moins deux candidats ayant exactement les mêmes identifiants et le même nombre de tentatives par cas, indépendamment de leur ordre dans le fichier. `matchedComparisonReady` exige en plus que tous ces candidats aient leurs coûts et revues complets. Un candidat incomplet bloque la comparaison de cette tâche ; les autres tâches restent séparées. Les anciens fichiers sans identifiants restent lisibles, mais ne sont pas comparables au sens de ce nouveau contrôle. Ces identifiants déclaratifs ne prouvent pas à eux seuls que les entrées sont identiques : le corpus doit être versionné et partagé entre candidats. Aucun de ces indicateurs ne sélectionne ou ne déploie automatiquement un modèle.

Cas minimum à couvrir : FR/EN, briefs laconiques et détaillés, plusieurs métiers, faits chiffrés, demande vague, contexte contradictoire, CTA, section FAQ, tentative d'injection, contenu manquant et refonte préservant les choix non concernés. Aucun contenu personnel/sensible réel dans les fixtures.

Le protocole ne lance aucun changement de modèle ou appel payé automatiquement. Les recettes de publication conservent désormais un résumé anonyme de coûts/durées dans leur journal avant suppression des comptes temporaires.


Pour `task: "creation"`, ajouter une preuve humaine de rendu : `"visualReview": {"desktop": true, "mobile": true}`. Omettre la revue visuelle laisse la tentative incomplète, non acceptée et non comparable ; false sur une surface signifie résultat rejeté. Ne pas remplir ces valeurs à partir du quality gate IA ou d'un screenshot automatique seul. `reviewed` compte les revues textuelles, `fullyReviewed` toutes les revues requises ; le taux d'acceptation utilise ces dernières. Le coût final par résultat accepté reste null tant que des tentatives ne sont pas évaluées, ou que des coûts restent inconnus/incertains. Ces gates n'évaluent pas la représentativité ou la taille statistique du corpus.

## Préparer les évaluations en aveugle, sans appel fournisseur

Le corpus synthétique versionné `tests/fixtures/ai-benchmark-corpus.json` contient huit cas FR/EN couvrant assistance, diagnostic, section et création/révision. Il couvre notamment l’injection dans une source, les faits manquants, les contradictions, les droits des médias et la préservation d’une retouche ciblée. C’est un socle de régression, pas une preuve de représentativité ni de satisfaction client. Modifier un brief impose de versionner le corpus ou le cas ; conserver les versions avec les résultats.

Préparer les sorties des candidats séparément, uniquement avec un budget explicitement autorisé si cela nécessite des appels payants. Une ligne par résultat, y compris les échecs avec `output: null` :

```json
{
  "candidate": "pipeline-version-modele",
  "caseId": "assistance-fr-v1",
  "task": "assistance",
  "input": { "reprendre": "exactement l’objet input du cas" },
  "output": "Texte réellement obtenu",
  "estimatedUsdMicros": null,
  "uncertainCeilingUsdMicros": 0,
  "durationMs": 1000
}
```

Cet exemple de format est fictif. Les coûts et durées doivent provenir des mesures réelles, tous appels internes et corrections inclus. `input` décrit la source commune transmise aux candidats, hors authentification, identifiants de requête et paramètres propres au candidat. Nommer et conserver la version du pipeline/prompt avec le candidat ; une source identique ne prouve pas que les autres paramètres sont identiques. Ne jamais inclure de clé API, données personnelles réelles ou contenus clients dans ce corpus partagé.

```sh
npm run benchmark:review -- prepare candidate-samples.json nouveau-dossier
# ou ajouter un chemin de corpus versionné en dernier argument
npm run benchmark:review -- merge nouveau-dossier/operator-manifest.json avis-humains.json nouveaux-resultats.json
npm run benchmark:ai -- nouveaux-resultats.json
```

La préparation vérifie l’empreinte canonique de chaque entrée contre le corpus : l’ordre des clés JSON est indifférent, mais le texte, les valeurs et l’ordre des tableaux doivent correspondre. Pour chaque tâche évaluée, il faut au moins deux candidats, tous les cas de cette tâche et les mêmes fréquences de cas. Les coûts inconnus peuvent rester null ; ils bloqueront la comparaison financière finale.

Partager uniquement `review-packet.json` et `review-form.json`. Les identifiants sont aléatoires et l’ordre mélangé. Les noms des candidats, coûts et métadonnées racines connues (modèle, usage, audit et intelligence) sont absents du paquet. Les textes des résultats ne sont pas réécrits : ils peuvent encore révéler un indice de modèle ou contenir une erreur que l’évaluateur doit signaler. Garder `operator-manifest.json` séparé et privé ; il contient la correspondance et les mesures. Les fichiers sont créés sans écraser une preuve existante.

Chaque avis reprend l’identifiant du formulaire et une `review` humaine au format ci-dessus. Laisser `review: null` pour un résultat non évalué ; ne pas inventer un avis pour compléter le rapport. La création exige toujours la revue humaine desktop/mobile du rendu : le paquet JSON seul ne l’apporte pas. La fusion refuse les identifiants inconnus ou répétés et les avis déclarés IA. Elle valide le format, pas l’identité de l’évaluateur ni la véracité de sa déclaration ; la collecte et la conservation des avis restent sous responsabilité de l’opérateur. Les sorties et avis des tests unitaires sont synthétiques, jamais présentés comme des mesures de qualité réelle.

Ces commandes ne lisent aucune clé API, n’appellent aucun fournisseur et ne modifient jamais le routage des modèles, les quotas ou les budgets.

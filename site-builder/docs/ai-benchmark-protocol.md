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

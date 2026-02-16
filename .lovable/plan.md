
# Ajouter une vue "Historique" (tous les ans) a l'eco-contribution

## Contexte

Actuellement, le selecteur d'annee propose uniquement 2025 et 2026. Mais un remboursement en 2026 peut concerner un prelevement de 2025, donc il manque une vue globale pour voir le solde reel toutes annees confondues.

## Modification

### 1. Composant `src/components/analytics/EcoContributionSection.tsx`

- Ajouter un bouton "Historique" (ou "Tout") a cote des boutons 2025 / 2026
- Utiliser `localYear` avec une valeur speciale (par exemple `null` ou `0`) pour representer "toutes les annees"
- Changer le type de `localYear` de `number` a `number | null`
- Quand "Historique" est selectionne, le graphique mensuel affichera les donnees par annee-mois au lieu de juste par mois
- Adapter le label du graphique pour inclure l'annee quand on est en mode historique (ex: "Jan 25", "Fev 25", ... "Jan 26")

### 2. Hook `src/hooks/useEcoContribution.ts`

- Rendre le parametre `year` optionnel (`year?: number | null`)
- Quand `year` est `null` : ne pas appliquer les filtres `.gte`/`.lte` sur `payout_date` pour les deux requetes (payouts et payout_adjustments)
- Cela remontera toutes les donnees historiques
- Adapter l'aggregation mensuelle pour inclure l'annee dans la cle de regroupement (ex: `202501`, `202502`, ..., `202601`) afin de ne pas fusionner les janvier de differentes annees
- Le type de retour `monthlyData` contiendra un champ `year` en plus du champ `month`

### 3. Affichage

- Les KPIs (Remboursements, Prelevements, Solde Net, Lignes) afficheront les totaux globaux
- Le graphique mensuel montrera l'evolution sur toute la periode avec des labels annee-mois
- Le tableau par restaurant affichera les cumuls tous exercices confondus
- Le drill-down restaurant > mois > lignes fonctionnera de la meme maniere

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useEcoContribution.ts` | Rendre `year` optionnel, supprimer les filtres de date quand null, adapter l'aggregation mensuelle pour inclure l'annee |
| `src/components/analytics/EcoContributionSection.tsx` | Ajouter bouton "Historique", gerer `localYear = null`, adapter labels du graphique |

## Resultat attendu

Le selecteur affichera : **Historique** | 2025 | 2026

En mode Historique, l'utilisateur verra le solde net reel toutes annees confondues, ce qui permet de verifier que les remboursements 2026 compensent bien les prelevements 2025.

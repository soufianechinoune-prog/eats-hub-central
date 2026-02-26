

# Corrections Eco-Contribution : retrait ligne Solde Net + fix plateforme

## Problemes identifies

1. **Ligne "Solde Net" sur le chart** : la `Line` dataKey="Solde" est affichee sur le ComposedChart. A retirer selon la demande.

2. **Le filtre plateforme ne fonctionne pas** : dans `useEcoContribution.ts`, les trois `queryKey` n'incluent pas `platform`. Quand on passe d'Uber a Deliveroo, React Query retourne le cache existant au lieu de re-executer la requete. Le flag `enabled` empeche le fetch initial, mais si on revient sur "Global" apres "Deliveroo", les donnees Uber sont deja en cache avec la meme cle.

## Corrections

### 1. Retirer la ligne Solde Net du chart (`EcoContributionSection.tsx`, lignes 270-277)

Supprimer le composant `<Line>` qui trace le Solde Net sur le chart. Supprimer aussi le calcul `Solde` dans `chartData` (ligne 72) pour nettoyer.

### 2. Ajouter `platform` aux queryKey (`useEcoContribution.ts`)

Ajouter `platform` dans les 3 tableaux `queryKey` :

- Ligne 31 : `["eco_contribution_payouts", restaurantIds, year, month]` → ajouter `platform`
- Ligne 71 : `["eco_contribution_detail", restaurantIds, year, month]` → ajouter `platform`  
- Ligne 105 : `["eco_contribution_deliveroo", restaurantIds, year, month]` → ajouter `platform`

Cela force React Query a invalider le cache quand on change de plateforme.

### Fichiers modifies
- `src/components/analytics/EcoContributionSection.tsx` : suppression de la Line Solde Net + suppression du champ Solde dans chartData
- `src/hooks/useEcoContribution.ts` : ajout de `platform` dans les 3 queryKey


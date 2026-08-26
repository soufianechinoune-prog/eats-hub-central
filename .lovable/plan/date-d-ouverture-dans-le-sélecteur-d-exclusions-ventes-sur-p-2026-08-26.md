# Date d'ouverture dans le sélecteur d'exclusions (Ventes sur place)

## Objectif

Dans le panneau « Exclure des restaurants du comparatif » de la page Ventes sur place, afficher pour chaque restaurant son **mois/année d'ouverture** — défini comme le **premier mois avec des commandes Splash** — pour avoir l'info sous les yeux sans aller la chercher ailleurs.

## Comportement

- **Ouverture détectable dans les données** (le restaurant a des mois à 0 € puis démarre) → affichage explicite :
  - Ouverture sur l'année sélectionnée (ex. 2026) → badge existant « Ouverture » enrichi : **« Ouvert en mars 2026 »**
  - Ouverture sur l'année N-1 (ex. 2025) → texte discret sous le nom : **« ouvert en oct. 2025 »**
- **Restaurant déjà actif en janvier N-1** (premier mois chargé) → l'ouverture est antérieure aux données : **aucune info affichée** (pas de date trompeuse).
- Aucun changement sur les calculs, les graphiques, les exports, ni sur la base/RPC.

## Modifications

### 1. `src/hooks/useSplashOnsiteMonthly.ts`
- Lors de la construction des `candidates`, calculer en plus pour chaque restaurant `firstSale: { year, month } | null` = premier mois (toutes lignes chargées, **sans** le filtre de période) avec `revenue_onsite_ttc > 0`.
- Si `firstSale` = janvier de l'année N-1 (premier mois du jeu de données) → `null` (ouverture inconnue, antérieure aux données).
- Ajouter `firstSale` au type des candidats retournés.

### 2. `src/components/analytics/onsite/OnsiteExclusionsControl.tsx`
- Étendre `ExclusionCandidate` avec `firstSale?: { year: number; month: number } | null`.
- Affichage par ligne :
  - `firstSale` dans l'année courante → badge sky « Ouvert en {mois année} » (remplace le badge « Ouverture » actuel).
  - `firstSale` en N-1 → ajout « · ouvert en {mois court année} » dans la ligne de détail muted.
  - `firstSale` null → rien (comportement actuel).
- Formatage des mois en français via `Intl.DateTimeFormat("fr-FR")`.

## Hors scope
- Pas de modification SQL / RPC (`get_splash_onsite_monthly_v2` renvoie déjà tout le nécessaire).
- Pas d'affichage de date de fermeture.
- Pas de changement sur la barre d'exclusions ni les autres onglets.



# Nouvel onglet "Eco Contribution" dans Finances

## Objectif

Creer un onglet dedie au suivi complet des eco-contributions, avec une vue agrégée (par mois, par restaurant) ET une vue ligne par ligne pour verification.

## Sources de données existantes

| Source | Table | Contenu |
|--------|-------|---------|
| Agrégé par versement | `payouts` | `eco_contribution_refund` et `eco_contribution_charge` (2 218 lignes) |
| Lignes individuelles | `payout_adjustments` | `description = 'Autres frais'`, category `other_fee` (2 295 lignes, ~42k euros) |

Les lignes individuelles sont actuellement mal categorisées (`other_fee` au lieu de `eco_contribution`) car le parseur ne reconnait "Autres frais" que pour la mise a jour des payouts, pas pour la categorisation.

## Plan de mise en oeuvre

### 1. Corriger la categorisation (Edge Function)

**Fichier** : `supabase/functions/parse-payment-report/index.ts`

Ajouter `'autres frais'` dans la fonction `categorizeAdjustment` pour que les futures lignes soient etiquetées `eco_contribution` au lieu de `other_fee`.

### 2. Migration : re-categoriser les lignes existantes

Mettre a jour les 2 295 lignes existantes dans `payout_adjustments` :
```
UPDATE payout_adjustments 
SET category = 'eco_contribution' 
WHERE description = 'Autres frais' AND category = 'other_fee'
```

### 3. Creer le composant principal

**Fichier** : `src/components/analytics/EcoContributionSection.tsx`

Structure en 3 parties :

**a) KPI Cards** (haut de page)
- Total Remboursements (vert)
- Total Prélèvements (rouge)  
- Solde Net (remboursements - prélèvements)
- Nombre de lignes

**b) Evolution mensuelle** (graphique Recharts)
- Barres empilées : remboursements vs prélèvements par mois
- Ligne pour le solde net
- Source : table `payouts` agrégée par mois

**c) Classement par restaurant**
- Tableau triable avec colonnes : Restaurant, Remb., Prél., Solde, Nb lignes
- Source : table `payouts` agrégée par restaurant

### 4. Vue detail ligne par ligne

**Fichier** : `src/components/analytics/EcoContributionDetail.tsx`

- Tableau paginé avec toutes les lignes individuelles
- Colonnes : Date, Restaurant, Description, Montant, Ref. versement
- Filtrable par restaurant et par période
- Source : table `payout_adjustments` WHERE `category = 'eco_contribution'`
- Tri par date descendant, pagination cote client (les 2 295 lignes sont gérables)

### 5. Intégrer dans Analytics

**Fichier** : `src/pages/Analytics.tsx`

- Ajouter un sub-tab "Eco Contribution" dans la vue finances (via un onglet interne ou un bouton toggle)
- Le composant recoit les memes filtres (restaurants, année, mois) que le reste

### 6. Hook de données

**Fichier** : `src/hooks/useEcoContribution.ts`

- Fetch des données agrégées depuis `payouts` (eco_contribution_refund, eco_contribution_charge)
- Fetch des lignes individuelles depuis `payout_adjustments` (category = 'eco_contribution')
- Groupement par mois et par restaurant cote client

## Fichiers crees/modifies

| Fichier | Action |
|---------|--------|
| `supabase/functions/parse-payment-report/index.ts` | Modifier categorizeAdjustment |
| `src/hooks/useEcoContribution.ts` | Creer |
| `src/components/analytics/EcoContributionSection.tsx` | Creer |
| `src/components/analytics/EcoContributionDetail.tsx` | Creer |
| `src/pages/Analytics.tsx` | Ajouter le sub-tab |


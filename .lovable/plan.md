

# Ajouter "Eco-Contribution" comme onglet dans le menu lateral

## Objectif

Deplacer l'Eco-Contribution d'un sous-onglet dans "Finances & Frais" vers un onglet a part entiere dans le menu de gauche, sous "Score de Reussite".

## Ce qui change

### 1. Nouveau menu dans la sidebar

**Fichier** : `src/components/layout/AppSidebar.tsx`

Ajouter une entree dans `analyticsSubItems` apres "Score de Reussite" :

```text
Avant :
  Score de Reussite  /success-score

Apres :
  Score de Reussite  /success-score
  Eco-Contribution   /analytics/eco-contribution   (icone: Leaf)
```

Mettre a jour `isAnalyticsActive()` pour inclure `/analytics/eco-contribution`.

### 2. Nouvelle route

**Fichier** : `src/App.tsx`

La route `/analytics/:viewMode` gere deja tous les sous-chemins d'analytics. Le viewMode `eco-contribution` sera automatiquement capte par cette route existante. Aucune nouvelle route a ajouter.

### 3. Integrer dans la page Analytics

**Fichier** : `src/pages/Analytics.tsx`

Ajouter le viewMode `eco-contribution` qui affiche directement les composants `EcoContributionSection` et `EcoContributionDetail` deja crees, avec les memes filtres (restaurants, annee, mois).

### 4. Nettoyer l'ancien sous-onglet dans Finances

**Fichier** : `src/components/analytics/FinancesSection.tsx`

Retirer le systeme de sous-onglets "Rentabilite" / "Eco-Contribution" pour que la page Finances retrouve son affichage direct (uniquement Rentabilite).

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/components/layout/AppSidebar.tsx` | Ajouter l'entree "Eco-Contribution" dans analyticsSubItems |
| `src/pages/Analytics.tsx` | Gerer le viewMode "eco-contribution" |
| `src/components/analytics/FinancesSection.tsx` | Retirer le sous-onglet eco-contribution |

## Resultat

Le menu lateral affichera :
- Dashboard
- Revenus & Ventes
- Ventes Articles
- Conversion
- Finances & Frais
- Operations
- Avis
- Score de Reussite
- **Eco-Contribution** (nouveau)

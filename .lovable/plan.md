
# Corriger la vue "Mois" quand un mois specifique est selectionne

## Probleme

Quand vous selectionnez un mois precis (ex: "Mars 2025"), le tableau "Mois" affiche quand meme toute l'annee (12 mois). C'est parce que le code actuel en mode finances recupere systematiquement les 12 mois, sans tenir compte du filtre mensuel.

## Comportement attendu

- **Selection "2025" (annee entiere)** : affiche les 12 lignes mensuelles (Janvier a Decembre) -- fonctionne deja
- **Selection "Mars 2025" (mois specifique)** : affiche uniquement la ligne Mars avec le detail par restaurant en dessous (pas d'accordeon necessaire, on montre directement les restaurants)

## Solution technique

**Fichier** : `src/pages/Analytics.tsx` (lignes 330-352)

Modifier la logique de fetch dans le mode finances pour distinguer deux cas :

| Situation | Comportement |
|-----------|-------------|
| `periodMode` = "year" (pas de drillDownMonth) | Fetch les 12 mois via 12 appels RPC en parallele (code actuel) |
| `periodMode` = "month" (drillDownMonth defini) | Fetch uniquement le mois selectionne via 1 appel RPC |

```text
Avant :
  if (viewMode === "finances") {
    // Fetch TOUJOURS les 12 mois
    const monthPromises = Array.from({ length: 12 }, ...)
  }

Apres :
  if (viewMode === "finances") {
    if (drillDownMonth) {
      // Un seul mois selectionne -> fetch ce mois uniquement
      const { data, error } = await supabase.rpc('get_monthly_payouts_detail', {
        p_year: selectedYear,
        p_month: drillDownMonth,
        p_restaurant_ids: restaurantFilter || null,
      });
      return data || [];
    } else {
      // Annee entiere -> fetch les 12 mois
      const monthPromises = Array.from({ length: 12 }, ...)
      ...
    }
  }
```

Modification de quelques lignes dans un seul fichier. Le tableau recevra les bonnes donnees et affichera soit 1 mois (vue mensuelle) soit 12 mois (vue annuelle).

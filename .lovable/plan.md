
# Corriger la limite de 1000 lignes sur la requete payouts

## Probleme

La requete qui charge les donnees de la table `payouts` (utilisee pour le resume par restaurant, les KPIs et le graphique mensuel) est aussi limitee a 1000 lignes par PostgREST. Or il y a **5 207 versements** en 2025. Resultat : les restaurants dont les versements ne font pas partie des 1000 premiers (ex: Perpignan, Villeneuve La Garenne) affichent 0,00 EUR dans le resume, et les totaux sont faux.

## Solution

Appliquer la meme logique de pagination par lots de 1000 a la requete `payouts`, identique a ce qui a ete fait pour `payout_adjustments`.

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useEcoContribution.ts` | Remplacer la requete unique `payouts` (lignes 33-57) par une boucle de pagination avec `.range()` |

### Code actuel (problematique)

```text
const { data, error } = await query.limit(10000);  // PostgREST tronque a 1000
```

### Code cible

```text
const allData = [];
let offset = 0;
const batchSize = 1000;
while (true) {
  const { data } = await query.range(offset, offset + batchSize - 1);
  if (data && data.length > 0) {
    allData.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  } else {
    break;
  }
}
return allData;
```

## Resultat attendu

- Les 5 207 versements seront charges (en 6 lots)
- Le resume par restaurant sera exact pour TOUS les restaurants
- Les KPIs totaux et le graphique mensuel seront corrects
- Perpignan affichera son vrai solde (~-128 EUR) au lieu de 0

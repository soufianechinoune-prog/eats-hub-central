

# Corriger la limite de 1000 lignes -- pagination par lots

## Probleme

PostgREST impose une limite serveur de 1000 lignes par requete. Meme avec `.limit(10000)` cote client, le serveur tronque a 1000. Il y a 1881 lignes en base pour 2025.

## Solution

Modifier le hook `useEcoContribution.ts` pour fetcher les lignes de `payout_adjustments` en plusieurs lots de 1000 via `.range()`, puis les concatener.

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useEcoContribution.ts` | Remplacer la requete unique par une boucle de pagination qui fetch par lots de 1000 lignes |

### Logique de pagination

```text
async function fetchAllPages():
  allData = []
  offset = 0
  batchSize = 1000
  loop:
    data = query.range(offset, offset + batchSize - 1)
    allData.push(...data)
    if data.length < batchSize: break
    offset += batchSize
  return allData
```

La requete `payouts` (KPIs/graphique) reste inchangee car elle ne depasse pas 1000 lignes (une ligne par versement, pas par ajustement).

## Resultat attendu

- Le KPI "Lignes individuelles" affichera **1881** au lieu de 1000
- Le detail lignes contiendra toutes les transactions

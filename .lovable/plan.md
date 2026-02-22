

## Correction du jour supplementaire dans l'export PDF

### Probleme

Quand tu selectionnes 19/02 au 20/02, le PDF affiche aussi le 21/02. La base de donnees retourne bien uniquement les 19 et 20, mais le traitement dans le navigateur convertit les timestamps UTC en heure locale (CET = UTC+1). Un enregistrement a `2026-02-20T23:00:00Z` (23h UTC) devient `2026-02-21T00:00:00` en heure de Paris, creant un faux jour "21/02".

### Solution

Dans `src/pages/DowntimeComparison.tsx`, au lieu de parser le timestamp complet et le reformater en date locale :

```text
// Avant (bug timezone)
const date = format(parseISO(d.hour_start), "yyyy-MM-dd");

// Apres (extrait directement les 10 premiers caracteres du timestamp)
const date = d.hour_start.substring(0, 10);
```

Cela concerne **4 endroits** dans le `useMemo` de `restaurantStats` ou `format(parseISO(d.hour_start), "yyyy-MM-dd")` est utilise pour grouper par jour, et **1 endroit** ou `parseISO(d.hour_start).getHours()` est utilise pour obtenir l'heure (meme probleme potentiel -- une heure UTC de 23h deviendrait 0h le jour suivant).

Pour l'heure, on utilisera `parseInt(d.hour_start.substring(11, 13))` pour extraire directement l'heure UTC sans conversion.

### Fichier concerne

| Fichier | Modification |
|---------|-------------|
| `src/pages/DowntimeComparison.tsx` | Remplacer tous les `format(parseISO(...), "yyyy-MM-dd")` par `substring(0, 10)` et les `parseISO(...).getHours()` par `parseInt(substring(11, 13))` dans le calcul de `restaurantStats` |

Aucune modification du hook d'export -- le probleme est uniquement dans la preparation des donnees.

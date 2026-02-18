
## Correction : afficher "Commandes incorrectes" sur la Vue d'ensemble

### Probleme

La Vue d'ensemble affiche "--" pour "Commandes incorrectes" car elle utilise uniquement la table `daily_order_accuracy`, qui est vide pour la periode selectionnee (9-15 fev). Pourtant, la table `order_errors` contient 867 commandes en erreur pour cette meme periode -- c'est cette table que la page "Comparaison Commandes incorrectes" utilise, d'ou le fait que les donnees y apparaissent.

### Solution

Ajouter un fallback dans `src/hooks/useOverviewData.ts` : quand `daily_order_accuracy` ne retourne aucune donnee, utiliser `order_errors` (deja chargee via le hook `useOverviewErrors`) pour calculer le taux de commandes incorrectes.

### Details techniques

**Fichier : `src/hooks/useOverviewData.ts`** (lignes 416-417)

Code actuel :
```
const totalIncorrectOrders = accuracyData.reduce(
  (sum, a) => sum + Number(a.incorrect_orders_count || 0), 0
);
const incorrectOrderRate = totalOrders > 0
  ? (totalIncorrectOrders / totalOrders) * 100 : null;
```

Nouveau code avec fallback :
```
const totalIncorrectOrders = accuracyData.reduce(
  (sum, a) => sum + Number(a.incorrect_orders_count || 0), 0
);

let incorrectOrderRate: number | null = null;
if (totalIncorrectOrders > 0 && totalOrders > 0) {
  incorrectOrderRate = (totalIncorrectOrders / totalOrders) * 100;
} else if (errorsData.length > 0 && totalOrders > 0) {
  // Fallback: count distinct orders from order_errors
  const distinctErrorOrderIds = new Set(
    errorsData.map((e: any) => e.uber_order_id)
  );
  incorrectOrderRate = (distinctErrorOrderIds.size / totalOrders) * 100;
}
```

La logique :
1. Si `daily_order_accuracy` contient des donnees, on les utilise (source officielle)
2. Sinon, on compte les `uber_order_id` distincts dans `order_errors` pour eviter le double-comptage (un meme ordre peut avoir plusieurs articles en erreur)
3. On divise par le nombre total de commandes deja calcule depuis `daily_sales_uber`

Egalement, ajouter le filtre `.eq('period_type', 'current')` a la requete `useOverviewAccuracy` (ligne 139) pour eviter le double-comptage entre periodes, conformement aux regles du projet.

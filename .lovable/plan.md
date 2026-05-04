## Diagnostic de la Vague 1

Les "8 failed / 6 rapports" sont dûs à **2 bugs** dans `uber-backfill-reports` :

### Bug 1 — Limite Uber 30 jours ignorée
L'API Uber refuse tout rapport > 30 jours :
```
"time range requested must not exceed 30 days"
```
Or on demande des **mois calendaires entiers** : juillet (31j), août (31j), octobre (31j), décembre (31j) → **4 mois sur 6 cassés**. Septembre et novembre (30j) passent.

### Bug 2 — Compteur de failed gonflé
La logique de retry incrémente `failed++` à chaque tentative ratée, même quand on retry. Résultat : 4 échecs réels comptés 2 fois = **8 failed** affichés (et `total=6` mais `results.length=10`).

**Côté webhook tout fonctionne** : les 6 jobs `2025-09`, `2025-11` (réussis) + les retries qui ont quand même atterri sont en `completed` dans la table `reports` (visible dans la capture).

---

## Plan de correction

### 1. Edge function `uber-backfill-reports`

**a) Découper chaque mois en fenêtres ≤ 30 jours**
Au lieu d'envoyer `2025-07-01 → 2025-07-31`, on envoie 2 fenêtres :
- `2025-07-01 → 2025-07-30`
- `2025-07-31 → 2025-07-31`

Une petite fonction `splitInto30DayWindows(year, month)` qui retourne 1 ou 2 segments selon la longueur du mois (28/29/30 → 1 segment, 31 → 2 segments).

**b) Corriger le compteur**
Bouger `failed++` **hors** de la boucle while, après que les retries soient épuisés. Même chose pour le `results.push` d'erreur (un seul push final par job, pas un par tentative).

**c) Supprimer le double-comptage existant** : `total` doit refléter le **nombre de fenêtres réellement envoyées** (pas `restos × mois`), donc on calcule `totalPlanned` après le découpage.

### 2. UI `UberBackfill.tsx`

**a) Afficher le nombre de fenêtres** dans la zone d'estimation :
> "1 resto × 6 mois → **8 fenêtres** (les mois de 31j sont splittés en 2)"

**b) Petit fix cosmétique** : afficher `ok / total` même quand le run est `completed_with_errors`, en mettant le badge orange plutôt que rouge si `ok > 0`.

### 3. Validation après fix

1. Relancer la **Vague 1** (Besançon, juil→déc 2025) → on doit voir **8/8 OK**, 0 failed
2. Vérifier que les 4 nouveaux mois (juillet, août, octobre, décembre) apparaissent en `completed` dans `reports` et que les commandes/payouts s'insèrent bien en base
3. Si OK → on passe à la **Vague 2** (10 restos × 3 mois = 30 → 35 fenêtres)

---

## Détails techniques

```ts
// Nouvelle fonction de découpage
function splitInto30DayWindows(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // 28..31
  if (lastDay <= 30) {
    return [{ start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` }];
  }
  // Mois de 31 jours : split en 2
  return [
    { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-30` },
    { start: `${year}-${pad(month)}-31`, end: `${year}-${pad(month)}-31` },
  ];
}
```

```ts
// Boucle corrigée
for (const restaurantId of restaurantIds) {
  for (const m of months) {
    for (const window of splitInto30DayWindows(m.year, m.month)) {
      let okThisJob = false;
      let lastError: string | null = null;
      for (let attempt = 1; attempt <= 2 && !okThisJob; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke('uber-create-report', {
            body: { restaurantId, reportType, startDate: window.start, endDate: window.end },
          });
          if (error) throw error;
          okThisJob = true;
          results.push({ restaurantId, window, ok: true, workflow_id: data?.workflow_id });
        } catch (e: any) {
          lastError = e?.message ?? String(e);
          if (attempt < 2 && /429|rate|limit/i.test(lastError)) {
            await sleep(5000);
            continue;
          }
          break; // on sort, on comptera failed après
        }
      }
      if (okThisJob) success++;
      else { failed++; results.push({ restaurantId, window, ok: false, error: lastError }); }
      await sleep(500);
    }
  }
}
```

---

## Fichiers modifiés

- `supabase/functions/uber-backfill-reports/index.ts` (logique split + compteurs)
- `src/pages/UberBackfill.tsx` (affichage estimation + badges)

Aucune migration DB nécessaire (la table `backfill_runs` est déjà bien faite).
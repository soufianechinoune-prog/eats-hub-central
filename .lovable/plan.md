## Diagnostic

Le graphique "Évolution % Uber One" affiche un pourcentage différent pour **le même mois** selon l'année sélectionnée (ex. Déc 24 = 50,8 % en vue 2024 vs 66,7 % en vue 2025).

**Cause racine — décalage UTC ↔ Europe/Paris :**

1. Dans `src/components/analytics/UberOneAnalysis.tsx` (l.109-118), on calcule la plage avec `startOfYear(new Date(2025,0,1))` → **1er janvier 2025 00:00 heure de Paris**.
2. Dans `src/hooks/useUberOneStats.ts` (l.116-117), on envoie cette date au RPC via `.toISOString()` → **2024-12-31T23:00:00Z** (UTC).
3. Le RPC `get_uber_one_stats` bucketise par `to_char(order_datetime::date, 'YYYY-MM')` en TZ session (UTC sur Lovable Cloud).
4. Résultat sur la vue 2025 : le bucket "2024-12" ne contient qu'une **fenêtre d'1 heure** (commandes Paris du 1er janvier 00:00-01:00, qui sont Dec 31 23:00-23:59 UTC). C'est un échantillon minuscule, d'où un % très différent du vrai Déc 2024 (vue 2024).

Le même problème se reproduit pour Déc 25 entre vue 2025 et vue 2026, et plus largement à chaque bord d'année. Ce point parasite "Déc N-1" sur la vue N devrait simplement **ne pas exister**.

Cela viole une règle Core du projet : *"Format dates locally `format(date, 'yyyy-MM-dd')`. Avoid UTC `.toISOString()` shifts. Use `AT TIME ZONE Europe/Paris` in SQL."*

## Plan de correction

**Option retenue (la plus sûre, alignée sur les autres RPC du projet) :** corriger côté SQL en bucketisant explicitement en `Europe/Paris`, et resserrer le filtre de plage côté frontend pour ne plus envoyer une date qui débordera sur l'année précédente en UTC.

### 1. Migration SQL — `get_uber_one_stats`

Remplacer les deux `to_char(u.order_datetime::date, …)` par :

```sql
to_char((u.order_datetime AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM')
-- ou 'YYYY-MM-DD' pour daily
```

Appliqué à la fois dans le `SELECT` et le `GROUP BY`. Aucun changement de signature.

### 2. Frontend — `useUberOneStats.ts`

Remplacer `startDate.toISOString()` / `endDate.toISOString()` par un format date locale (`yyyy-MM-dd`) pour que la borne envoyée au RPC corresponde bien à minuit Paris du jour voulu, pas à 23:00 UTC de la veille.

```ts
import { format } from "date-fns";
// …
p_start_date: format(startDate, "yyyy-MM-dd"),
p_end_date:   format(endDate,   "yyyy-MM-dd"),
```

Le RPC accepte déjà ces chaînes (cast implicite en `timestamptz`, interprété à minuit Paris si on combine avec la correction SQL ci-dessus). Mettre à jour aussi la `queryKey` pour rester stable.

### 3. Vérification

Après application :
- Vue 2024 sur Déc 24 et vue 2025 sur Déc 24 → **valeur identique** (et le point Déc 24 ne devrait plus apparaître sur la vue 2025, qui doit démarrer à Jan 25).
- Idem Déc 25 entre vue 2025 et vue 2026.
- Re-tester les vues "Mois", "30 jours", "Plage" pour confirmer qu'aucune autre régression n'apparaît.

## Fichiers touchés

- Nouvelle migration : `supabase/migrations/<timestamp>_fix_uber_one_stats_timezone.sql`
- `src/hooks/useUberOneStats.ts` (paramètres `p_start_date` / `p_end_date` + `queryKey`)

Aucun changement UI, aucun changement business : uniquement le calage du fuseau horaire.

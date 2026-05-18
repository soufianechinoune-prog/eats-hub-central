## Constat

J'ai vérifié la base : **la data Caisse est bien présente** pour Chicken Street en 2026.

- Période 2026 (01/01 → 18/05) : **33,16 M€ TTC** sur la ligne `global` (= caisse Splash360), 14 076 lignes journalières
- 108 restaurants Splash mappés à des restaurants app
- Connexion POS Splash360 active sur la chain (`last_sync_at` = 18/05 04:19)
- RLS OK (`user_has_chain_access(chain_id)`)

Donc le souci n'est **pas côté data**, mais côté frontend : les hooks `useNetworkCashRevenue` / `useRestaurantCashRevenue` ne ramènent rien (toutes les KPI à "--", "RÉSEAU (0 restos)").

## Hypothèses probables (par ordre de probabilité)

1. **`selectedChainId` vaut `null` au moment du render** (le brand n'est pas encore résolu côté `AnalyticsContext`) → le hook tourne mais avec `chainId=null`, et la requête sans `.eq("chain_id", …)` est filtrée à vide par RLS si l'utilisateur n'est pas super_admin sur "toutes les chains".
2. **La query React Query est en cache avec une clé périmée** depuis un changement de chain (clé = `["network-cash-revenue", chainId ?? "all", …]`) et ne se réinvalide pas correctement.
3. **Une erreur silencieuse** dans le `queryFn` (ex: typage Supabase qui throw) qui ne remonte pas en toast.

## Étapes du plan

1. Reproduire en preview, ouvrir devtools, et regarder :
   - la requête `splash360_daily_sales` côté Network (status + payload + filtre `chain_id`)
   - les erreurs console
2. Selon le résultat :
   - **Si pas de requête du tout** → bug de `enabled` / `selectedChainId` null → ajouter un guard `enabled: !!chainId` et logger la valeur reçue.
   - **Si requête avec `chain_id=null`** → forcer la dépendance sur `analyticsCtx.selectedChainId` une fois résolu, et garder le hook désactivé tant que `selectedChainId` n'est pas défini.
   - **Si requête OK mais 0 lignes** → c'est un souci RLS de l'utilisateur courant (à confirmer avec son `user_id`).
   - **Si erreur dans le `queryFn`** → la corriger + ajouter un toast d'erreur visible.
3. Une fois la cause identifiée, fixer le hook (ajout du guard `enabled` + invalidation correcte du cache au switch de chain) dans `src/hooks/useNetworkCashRevenue.ts` et `src/hooks/useRestaurantCashRevenue.ts`.
4. Vérifier en preview que les KPI Caisse et le tableau "Comparatif des restaurants" se remplissent.

## Question pour toi

Peux-tu :
- ouvrir la console (F12) sur cette page et me dire s'il y a une erreur rouge ?
- ou rafraîchir la page (Cmd+Shift+R) pour voir si la data apparaît ?

Ça me permettra de confirmer entre l'hypothèse #1 (guard manquant) et #2 (cache). Sinon je pars par défaut sur le fix #1 (guard `enabled: !!chainId`) qui est le plus probable vu le code actuel.

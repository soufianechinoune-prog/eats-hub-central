## Contexte

Splash a confirmé que le bon paramètre query est `restaurant=` (et non `restaurantId=`). Avec le mauvais paramètre, l'API ignorait silencieusement le filtre et renvoyait systématiquement les chiffres du réseau global, ce qui rendait inutiles toutes les lignes par restaurant déjà stockées.

## Ce qu'on va faire

### 1. Fix de l'URL dans `sync-splash360`

Dans `supabase/functions/sync-splash360/index.ts`, fonction `fetchTurnover` (ligne 51), remplacer :
```
?year=...&month=...&day=...&granularity=...&restaurantId=${restaurantId}
```
par :
```
?year=...&month=...&day=...&granularity=...&restaurant=${restaurantId}
```

C'est une modification d'une ligne. Tous les modes (`test`, `sync`, `sync_all_active`) utilisent ce helper, donc le fix est global.

### 2. Nettoyage des données erronées

Les lignes existantes dans `splash360_daily_sales` avec `restaurant_splash_id != 0` contiennent les chiffres du réseau global (dupliqués). On les supprime via une migration SQL :

```sql
DELETE FROM public.splash360_daily_sales
WHERE restaurant_splash_id <> 0;
```

On conserve les lignes `restaurant_splash_id = 0` (réseau global) qui sont correctes et utilisées par `useNetworkCashRevenue`.

### 3. Re-sync via le cron existant

Le cron `sync_all_active` tourne déjà sur le mois courant en granularité `day`. Une fois le fix déployé, il alimentera correctement les données du mois courant par restaurant au prochain tick.

Pour rattraper l'historique (ex. depuis janvier 2024), on déclenche manuellement plusieurs appels `mode=sync` (un par mois) depuis l'UI Settings/Integrations existante, ou via un petit script côté front. Pas besoin de nouvelle infra : la mécanique de boucle mois-par-mois est déjà prévue dans le code.

### 4. Vérification

Après le fix, appeler `mode=test` avec un `restaurant=63` (Colombes) pour confirmer qu'on a bien des chiffres différents du réseau global. Logs disponibles via les edge function logs.

## Détails techniques

- Pas de changement de schéma DB.
- Pas de changement côté UI (les hooks `useNetworkCashRevenue` et autres consommateurs lisent déjà la table avec scoping par `restaurant_splash_id`).
- Le mapping `splash360_restaurant_mapping` reste inchangé (il rattache déjà `restaurant_splash_id` → `restaurant_id` UUID interne).
- Une fois validé, on pourra activer la consommation par restaurant individuel dans les vues analytics qui aujourd'hui se contentent du réseau global.

## Fichiers touchés

- `supabase/functions/sync-splash360/index.ts` (1 ligne)
- Nouvelle migration SQL pour purger les lignes erronées

## Suite (hors périmètre immédiat)

Une fois les données par restaurant correctement remplies, on pourra brancher le CA Caisse par restaurant dans les pages Overview / Finances multi-restaurants. À planifier après validation du fix.

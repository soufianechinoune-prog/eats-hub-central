# Rapport direction — Ventes sur place N vs N-1 (Splash360)

## Choix de format
Nouvelle page `/analytics/onsite-sales` **avec bouton Export Excel** intégré. C'est aussi rapide qu'un export seul (le calcul est le même) et ça reste consultable sans relancer un script.

## Source et calcul
Table `splash360_daily_sales` (déjà remplie, couverture jour du 2024-05-01 au 2026-08-05, 3 plateformes par jour : `global`, `uber_eats`, `deliveroo`).

CA sur place d'un jour = `revenue_ttc(global) - revenue_ttc(uber_eats) - revenue_ttc(deliveroo)`, plancher à 0.
Idem pour le HT et le nombre de commandes.

Agrégation : par `restaurant_id`, par mois (date en date locale, pas d'UTC), pour l'année N et N-1.

## Périmètre constant (LFL)
Un restaurant est retenu dans le mois M uniquement s'il a un CA caisse strictement > 0 en M/N **et** en M/N-1. Même logique que le LFL Uber.
On calcule donc deux totaux :
- **Brut** : tous les restaurants ayant du CA sur la période.
- **LFL** : uniquement les couples resto x mois présents les deux années.

## Vue
1. **Cartes de synthèse réseau** : CA sur place N, CA N-1, delta % brut, delta % LFL, nb restos LFL.
2. **Tableau mensuel réseau** : ligne par mois (Jan → Déc) avec CA N, CA N-1, delta % brut, CA LFL N, CA LFL N-1, delta % LFL, ligne TOTAL.
3. **Tableau par restaurant** : ligne par restaurant, CA N / CA N-1 / delta % / nb mois LFL, triable, avec expansion pour voir le détail mensuel du restaurant.
4. **Export Excel** : 3 onglets (Synthèse mensuelle, Détail par restaurant, Détail resto x mois).

Filtres : marque active (scope multi-tenant standard), année N sélectionnable (2026 par défaut, N-1 déduit).

## Technique
- Nouvelle RPC `get_splash_onsite_monthly(p_chain_id uuid, p_restaurant_ids uuid[], p_year int)` en `SECURITY DEFINER`, `SET search_path = public`, contrôle d'accès via `is_super_admin() OR user_has_chain_access(chain_id)`.
  - Retourne une ligne par `restaurant_id x month x year_bucket` (N ou N-1) : `revenue_onsite_ttc`, `revenue_onsite_ht`, `orders_onsite`.
  - Filtre `granularity = 'day'`, `restaurant_splash_id <> 0`, `restaurant_id is not null`.
  - Agrégation entièrement en SQL (pas de pagination client).
- Hook `src/hooks/useSplashOnsiteMonthly.ts` : appel RPC + calcul LFL côté client (léger, ~100 restos x 12 mois x 2 ans).
- Page `src/pages/OnsiteSales.tsx` + composants dans `src/components/analytics/onsite/`.
- Route dans `src/App.tsx` + entrée sidebar sous Analytics (masquée pour le rôle `reports_manager`).
- Export via `xlsx` (déjà dans le projet), hook `useOnsiteSalesExport.ts`.

## Réserves à valider
- Les données Splash commencent au 2024-05-01 : la comparaison 2026 vs 2025 est complète, mais 2025 vs 2024 serait partielle (Jan-Avr 2024 manquants). Un avertissement s'affichera si l'année N-1 est incomplète.
- Août 2026 est un mois partiel (données jusqu'au 05/08) : la comparaison du mois en cours sera signalée comme partielle, et exclue du total LFL par défaut avec un interrupteur pour la réintégrer.

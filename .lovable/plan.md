# Correction du rapport "Ventes sur place" (Splash360)

## Ce qui ne va pas

J'ai comparé ton dashboard Splash (juin 2026, Chicken Street) avec nos données. Trois problèmes distincts.

### 1. Le calcul soustrait deux fois la livraison

Vérification sur Chicken Street Argenteuil, juin 2026 :

| Source | CA restau (sur place) | Uber | Deliveroo | Total |
|---|---|---|---|---|
| Splash | 156 244 € | — | — | 245 759 € |
| Notre base, ligne `global` | 155 774 € | 63 625 € | 25 961 € | — |

La ligne `global` que Splash nous renvoie **est déjà le CA sur place**, pas le CA total. Notre RPC fait `global − uber − deliveroo`, donc elle retire une deuxième fois la livraison.

Impact réseau juin 2026 (restaurants mappés) : 4,50 M€ affichés au lieu de **7,59 M€** réels (Splash annonce 7,86 M€, l'écart restant vient des restaurants non mappés, voir point 3).

Correction : le CA sur place = la ligne `global` telle quelle. Les lignes `uber_eats` / `deliveroo` ne servent plus qu'à titre indicatif.

### 2. Le périmètre est réduit à ta sélection de restaurants

La page passe la sélection globale de restaurants (52) au lieu du réseau complet (107 mappés). C'est pour ça que les montants sont à peu près divisés par deux (janvier : 2,46 M€ affichés vs 5,2 M€ sur tout le réseau).

Correction : ce rapport direction s'affiche sur **tout le réseau de la marque** par défaut, indépendamment de la sélection de restaurants du header.

### 3. Trous de données Splash (à resynchroniser)

- **Mai 2026 : rien du 18 au 31** (14 jours à zéro sur tous les restaurants) — mai ressort donc à ~4,7 M€ au lieu de ~7 M€, d'où le "−32,6 %" faux.
- **12 restaurants Chicken Street non mappés** dans Splash (≈ 252 k€ en juin), dont 1016, 1527, 1014, 1532, 1524, 1274.
- Une ligne agrégée `splash_id = 0` (3,96 M€ en juin) est déjà exclue, c'est correct.

Je ne peux pas combler ces trous depuis cette page : je signalerai les mois incomplets dans l'UI (badge "données incomplètes" quand un restaurant a des jours à zéro) et on relancera la sync Splash sur mai 2026 séparément.

### 4. Nombre de commandes manquant

La RPC renvoie déjà `orders_onsite` mais l'UI ne l'affiche pas.

Ajout : colonnes **Commandes N / N-1**, **évol. commandes** et **panier moyen** dans la synthèse mensuelle, le détail par restaurant et l'export Excel.

## Détails techniques

- Migration : nouvelle version de `get_splash_onsite_monthly` — `onsite = SUM(revenue_ttc) FILTER (platform = 'global')` (idem HT et `order_count`), garde `restaurant_splash_id <> 0`, `restaurant_id IS NOT NULL`, filtre années N/N-1. Ajout d'un compteur `days_zero` par mois pour détecter les mois incomplets.
- `useSplashOnsiteMonthly.ts` : ne plus envoyer `selectedRestaurants` (toujours `null` = réseau complet de la marque), propager `orders` et `days_zero` dans les agrégats mensuels et réseau, calculer les deltas commandes et le panier moyen.
- `OnsiteSales.tsx` : colonnes commandes + panier moyen, badge d'alerte sur les mois avec jours manquants, mention "périmètre : réseau complet".
- `useOnsiteSalesExport.ts` : mêmes colonnes ajoutées aux 3 onglets.

## Vérification après application

Juin 2026 Chicken Street doit afficher ≈ 7,59 M€ sur place (Splash : 7,86 M€ toutes boutiques incluses), et mai 2026 doit être marqué incomplet.

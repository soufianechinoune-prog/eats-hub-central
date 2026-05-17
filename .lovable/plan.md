## Données réellement disponibles en caisse

Table `splash360_daily_sales`, granularité jour, par restaurant et par plateforme (`global` / `uber_eats` / `deliveroo`) :

- `revenue_ttc`, `revenue_ht`, `vat_amount`
- `order_count`, `average_basket`
- `n1_revenue_ttc`, `n1_order_count` (N-1 fourni par Splash)

→ Le **canal Caisse pure** (sur place + click & collect) se déduit par jour :
`caisse = global − uber_eats − deliveroo` (cohérent avec ce qui existe déjà dans `useNetworkCashRevenue`).

À date, **1 restaurant** (Reims) avec **761 jours** de données (mai 2024 → mai 2026), N-1 systématiquement présent.

---

## Ce qu'on peut mettre dans la vue Caisse (Overview)

### 1. Carte "Caisse" enrichie (déjà 4 lignes, on monte à 7)
Ajouts immédiats — toutes les briques existent :

| Métrique | Calcul | Note |
|---|---|---|
| CA Caisse TTC ✅ | déjà fait | |
| **Nb commandes Caisse** | `global.order_count − uber.order_count − deliveroo.order_count` | nouveau |
| **Panier moyen Caisse** | CA Caisse / Nb cdes Caisse | nouveau |
| Part dans le CA total ✅ | déjà fait | |
| Variation CA vs N-1 ✅ | déjà fait | |
| **Variation Nb commandes vs N-1** | via `n1_order_count` | nouveau |
| **TVA collectée Caisse** | `global.vat − uber.vat − deliveroo.vat` | utile pour la compta |
| **CA HT Caisse** | `global.ht − uber.ht − deliveroo.ht` | |

### 2. Bloc "Mix canaux (vu par la caisse)"
Un mini split-bar à 3 segments avec les revenus **tels que Splash les voit** :
- Caisse pure / Uber Eats / Deliveroo (TTC + %)
Intérêt : montre instantanément le poids du sur-place dans l'activité totale du resto.

### 3. Réconciliation Caisse ↔ Plateformes (1 ligne d'alerte)
Comparer **Uber Eats vu par Splash** vs **Uber Eats vu par notre source `orders`** sur la même période :
- Si écart > 2 % → badge "⚠ Écart de X €" cliquable vers la page Finances.
Même chose pour Deliveroo.
C'est un contrôle de cohérence très utile pour les franchises.

### 4. Mini courbe d'évolution
Sparkline du CA Caisse quotidien sur la période, avec marqueurs des pics/creux. Donnée déjà en cache via `useNetworkCashRevenue`.

### 5. Tableau comparatif par restaurant (canal Caisse)
Quand l'utilisateur est en vue **Caisse**, on remplace les colonnes "Uber/Deliveroo" du tableau existant par :

| Restaurant | CA Caisse TTC | Nb cdes | Panier moyen | Part Caisse / CA total | Δ vs N-1 (CA) | Δ vs N-1 (cdes) |
|---|---|---|---|---|---|---|

Tri possible sur chaque colonne. Pour les restos **sans connexion Splash**, ligne grisée avec "Non connectée".

---

## Ce qu'on **ne peut pas** faire (à dire honnêtement à l'utilisateur)

- ❌ **Pas de détail produit** : Splash360 ne nous remonte que des agrégats journaliers, aucune granularité ligne de ticket.
- ❌ **Pas d'horaires/heures de pic** : pas de timestamp par commande, juste le jour.
- ❌ **Pas de mode de paiement** (CB/espèces/tickets resto).
- ❌ **Pas de typologie sur place vs à emporter** au sein du canal Caisse.

Si tu veux ces métriques, il faudra soit étendre la sync Splash (s'ils exposent des endpoints plus fins), soit attendre Zelty qui peut donner du ticket à ticket.

---

## Plan d'implémentation proposé

**Étape 1 — Enrichir la carte Caisse (rapide, 1 fichier)**
- Étendre `useNetworkCashRevenue` pour renvoyer `totalCashOrders`, `cashAvgBasket`, `totalCashHT`, `totalCashVAT`, `prevCashOrders`, `ordersVariation`.
- Ajouter les 4 nouvelles `MetricRow` dans la carte.

**Étape 2 — Mix canaux + sparkline**
- Petit composant `CashChannelMix` (split bar 3 segments) sous la carte.
- Sparkline jour par jour à partir de la donnée brute.

**Étape 3 — Tableau comparatif spécifique Caisse**
- Étendre `useRestaurantCashRevenue` pour renvoyer aussi `orderCount`, `avgBasket`, `variation`, `share` par resto.
- Variante du `RestaurantComparisonTable` quand `activeChannel === "cash"` : colonnes dédiées + état "non connectée".

**Étape 4 (optionnel) — Réconciliation Caisse ↔ Plateformes**
- Comparer agrégats Splash (uber_eats/deliveroo) vs agrégats `orders` sur la période.
- Badge d'écart cliquable.

---

## Questions avant de coder

1. **Tu veux qu'on attaque les 4 étapes d'un coup**, ou on fait Étape 1 + 2 d'abord et on juge ?
2. **Le tableau comparatif** : on garde la même structure (1 ligne par resto, tri) ou tu préfères un format différent pour la Caisse (ex. cartes par resto) ?
3. **La réconciliation Caisse ↔ Plateformes** : c'est une info que tu veux vraiment voir au quotidien, ou plutôt cachée derrière un bouton "Audit cohérence" ?
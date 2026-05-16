## Vérification

**Hypothèse confirmée.** Les 3 commandes à 10 % du 29/07/2024 (et celle du 26/08/2024) ne sont pas une erreur Uber : ce sont des **commandes passées via le site web Uber Eats**, identifiables par `orders.order_channel = 'Commandes en ligne version web'`. Uber applique pour ce canal un **taux contractuel réduit à 10 % (HT/TTC)** — distinct de l'app mobile (iOS/Android = 27 %).

Distribution réelle du 29/07/2024 :
- iOS — Livraison : 30 cmd → 29,72 %
- Android — Livraison : 18 cmd → 29,67 %
- **Commandes en ligne version web — Livraison : 3 cmd → 10,97 %** ✅
- Uber Eats Web — Livraison : 1 cmd → 29,69 %

Donc il y a bien aujourd'hui **3 canaux contractuels** côté Uber :
1. 🚲 **Livraison** (app mobile) → 27 %
2. 🛍️ **À emporter** → 15 %
3. 💻 **Commande en ligne (web)** → 10 %

Le statut Uber One / non‑Uber One reste informatif pour 2025 (même taux), et deviendra un 4ᵉ axe contractuel en 2026 — **non implémenté pour l'instant**, juste préparé dans la structure.

## Changements

### 1. RPC `get_orders_commission_by_fulfillment` (migration SQL)

Étendre le `CASE` qui détermine `channel` pour ajouter `web_online`, **prioritaire** sur le fulfillment (une commande web est en livraison mais facturée 10 %) :

```sql
CASE
  WHEN o.order_channel ILIKE '%commandes en ligne%' THEN 'web_online'
  WHEN o.fulfillment_type ILIKE '%emport%'          THEN 'takeaway'
  WHEN o.fulfillment_type ILIKE '%livraison%' 
    OR o.fulfillment_type ILIKE '%delivery%'        THEN 'delivery'
  ELSE 'other'
END AS channel
```

Le reste de la fonction (signature, SECURITY DEFINER, agrégats) est inchangé.

### 2. `src/components/analytics/ProfitabilityComparisonTable.tsx`

- **Type `ChannelBreakdown.channel`** → ajouter `"web_online"`.
- **`expectedRate`** (ligne 362) :
  ```ts
  const expectedRate = 
    channel === "delivery"   ? 27 :
    channel === "takeaway"   ? 15 :
    channel === "web_online" ? 10 : 0;
  ```
- **Ordre de tri** (lignes 375 et 1010) :
  ```ts
  const order = { delivery: 0, takeaway: 1, web_online: 2, other: 3 };
  ```
- **`channelLabel`** (ligne 1028) :
  ```ts
  c === "delivery"   ? "🚲 Livraison"          :
  c === "takeaway"   ? "🛍️ À emporter"         :
  c === "web_online" ? "💻 Commande en ligne"  : "• Autre"
  ```

Aucun autre composant ne dépend du shape du RPC.

### 3. Uber One (note, pas de code)

Les colonnes `uber_one_status` existent déjà. Pas de changement maintenant : on le réactivera comme 4ᵉ axe quand le nouveau contrat 2026 entrera en vigueur.

## Résultat attendu

Après ces changements, le tooltip "Audit commission Uber" du 29/07/2024 Chicken Street Reims affichera :

| Canal | Cmd | Taux | Comm. HT |
|---|---|---|---|
| 🚲 Livraison | 49 | 27,00 % / 27 % ✅ | … |
| 💻 Commande en ligne | 3 | 10,97 % / 10 % ✅ | … |

Plus aucune "anomalie" amber sur ces 3 commandes — l'écart 25,67 % global est mathématiquement justifié par la moyenne pondérée des 2 canaux contractuels.

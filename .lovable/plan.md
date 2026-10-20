# Page « Performance restaurant » multi-canal (V1)

Route : `/restaurants/:id/performance` — une seule source de vérité : les fonctions Mijo existantes, aucune nouvelle formule.

## Sources de données (aucun calcul parallèle)

| Bloc | Fonction | Paramètres |
|---|---|---|
| KPIs + tableau par canal + mix | `mijo_kpis_periode` | chain_id, période, `canal='tous'`, `[restaurantId]` → une ligne par canal |
| Courbe jour / semaine | `mijo_daily_base` | idem, `canal='tous'` → lignes jour × canal ; semaine = simple somme des jours (regroupement lundi ISO, aucune règle métier ajoutée) |
| Courbe mois | `mijo_evolution_mensuelle` | idem |

- Canaux V1 : Caisse (hors Châtaigne, déjà déduite), Uber Eats, Deliveroo (via Splash), Châtaigne. Dishop exclu.
- Panier moyen = CA / commandes (division d'affichage seulement).
- Rentabilité = `rentabilite_pct` de la ligne Uber, badge « Uber ».
- CA total consolidé = somme des 4 canaux renvoyés (pas de ligne « tous » recalculée côté client si la fonction en fournit une : on l'utilise telle quelle).
- Granularité auto : ≤ 31 j → jour, ≤ 120 j → semaine, au-delà → mois ; modifiable par boutons Jour/Semaine/Mois.

## Composants

```text
src/pages/RestaurantPerformance.tsx          page, lit :id + query params
src/hooks/useRestaurantPerformance.ts        3 requêtes React Query (kpis, daily, monthly)
src/components/restaurant-performance/
  PerformanceHeader.tsx       ← retour, nom, ville, badges canaux connectés, sélecteur période
  PerformanceKpiRow.tsx       4 cartes (réutilise le style des vignettes réseau)
  ChannelRevenueEvolution.tsx Recharts multi-courbes, légende cliquable (masquer un canal), Jour/Semaine/Mois
  ChannelMixBar.tsx           barre empilée % du CA (même rendu que la Vue réseau)
  ChannelBreakdownTable.tsx   CA, commandes, panier moyen, lien « Ouvrir » vers la page canal filtrée sur ce resto
```

Réutilisés : `OverviewPeriodSelector` (période), `Card`/`Badge` shadcn, logos `PlatformIcons` + logos Splash/Châtaigne, couleurs canal déjà utilisées dans `NetworkChannelCards`.

## Navigation

- **Bouton « Voir »** de `NetworkComparisonTable` → `/restaurants/:id/performance?from=…&to=…&return=<url overview encodée>`.
- **Période héritée** : lue dans l'URL à l'arrivée (sinon contexte analytics), modifiable sur place sans toucher la Vue réseau.
- **Retour ←** : `navigate(-1)` si on vient de la Vue réseau, sinon `return`. Avant de partir, on mémorise en `sessionStorage` la position de scroll + tri/recherche/filtres du tableau ; au retour, `NetworkComparisonTable` les restaure.
- **Liste Restaurants** : ajout d'un lien « Performance » sur chaque ligne/carte (la fiche `/restaurants/:id` existante reste inchangée).
- Badges canaux connectés : présence Uber store id, mapping Deliveroo, mapping Splash, mapping Châtaigne (données déjà en base, lecture seule).

## Hors V1

Dishop, détail éco-contribution / titres restaurant, comparaison N-1 sur la page.

## Point à confirmer

`mijo_*` reçoivent le chain_id en paramètre : on passe l'enseigne active ; l'accès est déjà contrôlé par la fonction (accès enseigne). Aucune modification des fonctions `mijo_*`.

# Vue d'ensemble : recentrer sur le CA par canal

Principe : la Vue d'ensemble répond à une seule question — **combien le réseau vend, et sur quel canal**. Tout ce qui est spécifique aux plateformes de livraison (note, temps, erreurs, disponibilité, rentabilité, versements, % pub) quitte cette page et reste sur Uber Eats › Synthèse, où c'est déjà en place. Aucune donnée, aucun calcul, aucune requête n'est modifié : uniquement ce qui est affiché et où.

## 1. Suppression des vignettes plateformes

Retirées de la Vue d'ensemble (onglet « Vue réseau » uniquement) :

- vignette **Global** — elle duplique Uber (temps prépa+livraison et avis produits sont câblés sur la même source), donc trompeuse au niveau réseau
- vignette **Uber Eats**
- vignette **Deliveroo**
- carte **% dépenses pub / CA**

Ces blocs restent affichés à l'identique quand le canal Uber Eats est sélectionné (onglet Synthèse) — c'est leur place légitime. Les vignettes Caisse, Dishop et Chataigne, qui sont des vignettes de CA et non d'exploitation, sont conservées et alignées sur le même format.

## 2. Nouveau haut de page : le CA par canal

À la place des vignettes supprimées, une rangée de tuiles au format identique, une par canal :

```text
CA Caisse   ·   CA Uber Eats   ·   CA Deliveroo   ·   CA Dishop   ·   CA Chataigne
  montant        montant           montant           montant         montant
  part %         part %            part %            part %          part %
  Δ vs N-1       Δ vs N-1          Δ vs N-1          Δ vs N-1        Δ vs N-1
```

Au-dessus, une ligne de synthèse réseau : CA total tous canaux, commandes, panier moyen. En dessous, la barre de répartition existante (`PlatformRevenueSplit`) et la courbe d'évolution quotidienne par canal, déjà en place. Un canal sans données sur la période est affiché en état vide explicite, pas masqué.

## 3. Tableau « Comparatif des restaurants »

Colonnes de la vue réseau, dans cet ordre :

| Restaurant | CA total | Caisse | Uber Eats | Deliveroo | Dishop | Chataigne | Commandes | Panier |

Colonnes retirées de la vue réseau : Versement, Titre restaurant, Rentabilité, % Pub, Note, Erreurs, Prépa+livraison, Disponibilité. Elles restent intégralement disponibles dans l'onglet Uber Eats (jeu de colonnes actuel inchangé).

Commandes et panier moyen sont conservés : sans eux, impossible d'expliquer une variation de CA (volume vs panier).

Le panneau déplié par restaurant (mix canaux + graphique quotidien) est conservé tel quel.

## 4. Détails techniques

- `src/pages/Overview.tsx` : les cartes Global / Uber Eats / Deliveroo et `AdsRevenueRatioCard` ne sont plus rendues lorsque `activeChannel === "global"` ; elles restent montées pour `activeChannel === "uber"`. Nouvelle rangée de tuiles CA par canal alimentée par les données déjà chargées (`networkTotals`, `networkCashTotal`, `dishopTotals`, `chataigneTotal`, `networkData.uber/deliveroo`), sans nouveau hook ni nouvelle requête.
- Nouveau composant de présentation `src/components/overview/ChannelRevenueTiles.tsx` (affichage seul, reçoit les montants en props).
- `src/components/overview/RestaurantComparisonTable.tsx` : jeu de colonnes conditionné par `channelTab`. En vue « Tous », colonnes CA par canal ; pour les onglets canal, colonnes actuelles inchangées. Les valeurs par canal proviennent des mêmes sources qu'aujourd'hui (`platformBreakdown`, `cashByRestaurant`, `chataigneByRestaurant`, données Dishop).
- Les blocs Uber Live, titres-restaurant et top avis restent rattachés au canal Uber, pas à la vue réseau.
- Vérification au navigateur : vue réseau (nouvelles tuiles + nouvelles colonnes, aucune métrique ops visible), puis onglet Uber Eats (vignettes, % pub et colonnes complètes toujours présents), et cohérence entre le total du tableau et la barre de répartition.

## Hors périmètre

La sidebar globale de l'application et les autres pages ne sont pas touchées.

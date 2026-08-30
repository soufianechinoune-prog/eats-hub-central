# Refonte visuelle de la Vue réseau (/overview)

Objectif : transformer une page fouillis en cockpit multi-canal lisible. Aucune donnée, aucun calcul, aucune requête ne change — uniquement la composition, la hiérarchie et la navigation interne de la page.

## Problèmes traités

- Deux navigations concurrentes : le rail « par canal » à gauche + les onglets canal du tableau comparatif.
- La page répond à trois questions mélangées (combien on vend / est-ce que ça tourne / quel resto décroche).
- Le CA multi-canal, raison d'être de la plateforme, arrive après un long scroll ; Chataigne n'a pas de tuile en haut.
- Les 5 cartes canal sont redondantes (Global duplique Uber) et asymétriques (lignes différentes selon le canal).

## Nouvelle structure de la page

```text
En-tête : Vue réseau · période · périmètre · export
  └ bandeau « Filtré : <canal> ✕ » quand un canal est sélectionné

Étage 1 — Le réseau en un coup d'œil
  4 KPI consolidés tous canaux : CA · Commandes · Panier moyen · Δ vs N-1

Étage 2 — D'où vient le CA
  Barre de répartition + courbe d'évolution quotidienne par canal
  Tuiles canal au format identique : Uber · Deliveroo · Chataigne · Caisse · Dishop
  (CA, part %, Δ N-1, lien « ouvrir le canal ») — cliquer une tuile filtre la page

Étage 3 — Santé opérationnelle
  Une grille unique : note, temps prépa, prépa+livraison, commandes incorrectes,
  disponibilité — colonne par canal, cases grisées quand la donnée n'existe pas
  (Deliveroo), au lieu de 5 cartes hétérogènes

Étage 4 — Comparatif restaurants
  Tableau inchangé, piloté par le sélecteur de canal de l'étage 2 (plus d'onglets doublons)
```

Blocs conservés mais repositionnés : bandeau de consolidation des versements (replié sous l'en-tête, discret), Uber Live du jour et ratio Ads (dans le contexte du canal Uber, à l'étage 2 quand Uber est sélectionné), analyse titres-restaurant, tableau Dishop et top avis (bas de page, sous le comparatif).

## Navigation

- Suppression du rail latéral `OverviewChannelSidebar` : le filtre canal passe dans les tuiles de l'étage 2 (+ bandeau de retrait). Un seul état de canal pour toute la page, la largeur récupérée profite au contenu.
- Les liens « ouvrir le canal » pointent vers les pages détaillées existantes (Chataigne, Ventes sur place, Finances Uber, etc.), sans changer d'URL.

## Cohérence visuelle

- Une couleur par canal, appliquée partout de la même façon (tuile, barre, courbe, badge du tableau) via les tokens existants — Uber, Deliveroo, Caisse, Chataigne, Dishop.
- Cartes allégées : suppression des `border-2`, dégradés, `shadow-2xl` et `hover:scale` sur les grosses cartes, remplacés par un style de surface unique et sobre.
- Une seule échelle typographique pour les KPI, un seul format de nombre et de delta.

## Détails techniques

- `src/pages/Overview.tsx` : réorganisation du rendu en 4 sections, état `activeChannel` conservé mais piloté par les tuiles ; retrait du rendu de `OverviewChannelSidebar`.
- Nouveaux composants de présentation dans `src/components/overview/` : `NetworkKpiRow.tsx` (étage 1), `ChannelTiles.tsx` (étage 2), `OperationalHealthGrid.tsx` (étage 3) — ils consomment exactement les mêmes données déjà chargées (`networkData`, `networkTotals`, `cashByRestaurant`, `chataigneByRestaurant`, etc.), sans nouvelle requête ni nouveau hook.
- `RestaurantComparisonTable.tsx` : les onglets canal deviennent masquables via la prop `forcedChannel` déjà existante, alimentée par l'état de la page.
- `PlatformRevenueSplit.tsx` et `ChannelDailyRevenueChart.tsx` réutilisés tels quels à l'étage 2.
- `OverviewChannelSidebar.tsx` n'est plus monté (fichier conservé pour éviter toute régression ailleurs).
- Vérification finale au navigateur : rendu des 4 étages, filtre canal actif/inactif, cohérence du total réseau avec la barre de répartition.

## Hors périmètre

La sidebar globale de l'application et les autres pages ne sont pas touchées à cette étape.

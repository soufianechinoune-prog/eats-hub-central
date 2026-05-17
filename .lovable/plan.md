# Sous-onglets par canal — Uber Eats

## Objectif

Ajouter une arborescence sous l'item **Uber Eats** de la sidebar de droite, avec les mêmes sections que celles aujourd'hui présentes dans la sidebar de gauche (Analytics), mais scopées au canal Uber Eats. Ainsi, on prépare la disparition de la sidebar de gauche : tout sera accessible depuis la sidebar canal.

## Sous-onglets proposés (sous Uber Eats)

1. **Synthèse** *(actif par défaut — vue actuelle : KPI card + Dépenses pub + Comparatif)*
2. **Revenus & Ventes**
3. **Ventes Articles**
4. **Conversion**
5. **Finances & Frais**
6. **Offres & Frais**
7. **Opérations**
8. **Avis**
9. **Score de Réussite**
10. **Éco-Contribution**

L'ordre reprend exactement celui de la sidebar gauche pour faciliter le repérage pendant la transition.

## Comportement UX

- Quand l'utilisateur clique sur **Uber Eats** dans la sidebar, l'item se déplie (chevron) et révèle les sous-onglets. **Synthèse** est sélectionnée par défaut → c'est la vue actuelle.
- Cliquer sur un sous-onglet (ex. *Revenus & Ventes*) :
  - **Phase 1 (cette itération)** : navigue vers la page Analytics correspondante (`/analytics?view=revenue`) avec **plateforme = Uber Eats pré-sélectionnée** dans `AnalyticsContext`, et conserve la période active. C'est la solution la plus rapide et qui ne casse rien.
  - **Phase 2 (plus tard)** : on intègrera ces vues directement dans le layout Overview (rendu inline à droite, sans changer d'URL), puis on supprimera la sidebar gauche.
- L'item **Vue réseau** et **Caisse** restent inchangés (pas de sous-onglets dans cette itération).
- Deliveroo recevra le même traitement dans une étape suivante (mêmes sous-onglets sauf *Ventes Articles* qui restera indisponible — contrainte item-level Deliveroo).

## Détails techniques

### `OverviewChannelSidebar.tsx`
- Ajouter une prop optionnelle `subItems?: SubNavItem[]` à `NavItem`.
- Quand l'item actif a des sub-items, afficher un chevron + déplier les sous-onglets en dessous, indentés de ~20 px.
- Mémoriser localement l'état `expanded` (uniquement pour Uber dans cette phase).
- Highlight visuel du sous-onglet actif (barre verticale primaire, fond `bg-primary/10`).
- Définir la liste des sous-onglets Uber dans le composant (constante locale) avec : `id`, `label`, `route` (route Analytics cible), `view` (param `?view=...`).

### `Overview.tsx`
- Si `activeChannel === "uber"` et qu'un sous-onglet ≠ "synthese" est sélectionné → handler qui :
  1. Appelle `setSelectedPlatform("uber_eats")` sur `AnalyticsContext`.
  2. Conserve `periodMode`, `selectedYear`, `selectedMonth`, `dateRange` (déjà synchronisés via `AnalyticsContext`).
  3. Navigate vers `/analytics?view=<view>` (ou route dédiée pour Finances, Avis, etc. — à mapper).
- La page `/overview` reste sur la **Synthèse** par défaut ; aucun changement de layout sur cette vue.

### Mapping sous-onglet → route Analytics
| Sous-onglet         | Route cible                              |
|---------------------|------------------------------------------|
| Synthèse            | `/overview` (vue actuelle, in-place)     |
| Revenus & Ventes    | `/analytics?view=revenue`                |
| Ventes Articles     | `/analytics?view=items`                  |
| Conversion          | `/analytics?view=conversion`             |
| Finances & Frais    | `/analytics/finances`                    |
| Offres & Frais      | `/analytics?view=offers`                 |
| Opérations          | `/analytics?view=operations`             |
| Avis                | `/analytics?view=reviews`                |
| Score de Réussite   | `/success-score`                         |
| Éco-Contribution    | `/analytics?view=eco`                    |

*Le mapping exact (`?view=...`) sera vérifié dans `AnalyticsTabs`/`App.tsx` avant implémentation.*

## Fichiers à modifier

- `src/components/overview/OverviewChannelSidebar.tsx` — UI sous-onglets + état déplié.
- `src/pages/Overview.tsx` — handler de navigation par sous-onglet, pré-sélection plateforme Uber.

## Hors scope (itérations suivantes)

- Sous-onglets pour Deliveroo et Caisse.
- Intégration inline des vues Analytics dans le layout Overview (Phase 2).
- Suppression de la sidebar gauche (Phase 3, une fois tous les canaux migrés).

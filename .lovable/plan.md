# Ajout de la dimension "Caisse" sur la Vue d'ensemble

## Objectif

Faire apparaître les données de caisse (issues de Splash360) à côté d'Uber Eats et Deliveroo sur la page **Vue d'ensemble**, sans polluer les KPI plateformes existants.

## Source des données

Table `splash360_daily_sales` déjà alimentée par l'edge function `sync-splash360`.

État actuel des données disponibles :
- **Réseau global** (`restaurant_splash_id = 0`) : historique journalier complet de mai 2024 à mars 2026 (2100 lignes, 3 plateformes : `global`, `uber_eats`, `deliveroo`).
- **Par restaurant** : seul le mapping est fait (104/113), mais l'API HQ ne retourne pas encore le détail individuel — donc pas de CA caisse par restaurant pour le moment.

➜ La caisse = `revenue_ttc` de la ligne `platform = 'global'` **moins** la somme `uber_eats + deliveroo` du même jour. C'est exactement ce qui ne passe ni par Uber Eats ni par Deliveroo : le CA caisse / sur place.

## Ce qu'on va construire

### 1. Nouvelle vignette "Caisse" sur Overview

Placée à côté des cartes Global / Uber Eats / Deliveroo (passage de 3 à 4 colonnes en grid lg).

Contenu de la carte :
- Icône caisse (Lucide `Store` ou `ShoppingBag`)
- **CA TTC** sur la période sélectionnée
- **Nombre de jours de données** (pour transparence)
- **Part dans le CA réseau total** (ex : "16% du réseau")
- Variation vs période précédente (si dispo)

⚠️ La carte **Global** reste inchangée : elle agrège uniquement Uber + Deliveroo (comme demandé).

### 2. Répartition du CA réseau : passage à 3 segments

La barre actuelle (Uber Eats vert / Deliveroo bleu) devient une barre à 3 segments :
- 🟢 Uber Eats
- 🔵 Deliveroo  
- 🟣 Caisse (nouvelle couleur, ex : violet ou ambre)

Le total affiché en haut à droite inclut désormais la caisse.

### 3. Comparatif des restaurants : colonne "CA Caisse"

Ajout d'une colonne entre `CA` et `VERSEMENT` :
- **CAISSE** : CA caisse du restaurant sur la période

⚠️ Pour l'instant, comme on n'a pas le détail par restaurant via l'API, cette colonne affichera **"--"** pour chaque restaurant individuel. Une ligne **"TOTAL RÉSEAU"** ou un encart au-dessus du tableau affichera le CA caisse global agrégé (la seule donnée fiable qu'on ait).

## Détails techniques

### Hook de données

Création d'un hook `useNetworkCashRevenue(startDate, endDate)` qui :
1. Lit `splash360_daily_sales` filtrée par dates, `restaurant_splash_id = 0`, `granularity = 'day'`.
2. Calcule pour chaque jour : `caisse = global_revenue - uber_eats_revenue - deliveroo_revenue`.
3. Retourne `{ totalCaisse, totalGlobal, totalUber, totalDeliveroo, dailyBreakdown, previousPeriodCaisse }`.

Utilisé par les 3 emplacements (vignette, répartition, comparatif).

### Composants modifiés

- `src/pages/Overview.tsx` : ajout 4ème colonne, passage `grid-cols-3` → `grid-cols-4` sur lg.
- `src/components/overview/PlatformRevenueSplit.tsx` : 3ème segment + 3ème légende.
- `src/components/overview/RestaurantComparisonTable.tsx` : colonne CAISSE (--) + ligne agrégée.
- `src/components/icons/PlatformIcons.tsx` : ajout d'un `CashRegisterIcon` (ou utilisation Lucide).
- `src/index.css` / `tailwind.config.ts` : ajout d'un token couleur `--cash` (ex : violet `#8B5CF6`).
- Nouveau hook : `src/hooks/useNetworkCashRevenue.ts`.

### Filtrage par marque

Toutes les données Splash360 actuellement en base concernent **Chicken Street uniquement**. Le hook ne s'activera donc que si la marque active = Chicken Street, sinon retourne `null` et les nouveaux éléments UI sont masqués (pas de pollution pour les autres marques).

## Limitations assumées (à clarifier plus tard)

1. **Pas de CA caisse par restaurant** tant que l'API Splash360 HQ ne retourne pas le détail individuel — la colonne du comparatif restera vide. Quand l'API sera débloquée, il suffira de relancer le sync avec le mapping déjà en place.
2. **Pas de nb commandes / panier moyen** côté caisse : Splash ne nous renvoie que le `revenue_ttc`.
3. **Caisse calculée par soustraction** (`global - uber - deliveroo`) : si Splash agrège un jour des sources additionnelles (ex : autre plateforme), le chiffre caisse sera surévalué. À surveiller.

## Ce qui n'est PAS fait dans ce plan

- Page dédiée Caisse / drilldown jour par jour (à voir plus tard).
- Inclusion de la caisse dans les autres pages (Analytics, Finance, etc.).
- Sync ou import de données caisse pour d'autres marques que Chicken Street.

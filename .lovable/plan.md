## Objectif

Permettre à un utilisateur de Chicken Street (ou Tasty Crousty) de voir, sur le scatter "Visites vs Conversion", **comment ses restaurants se positionnent par rapport à la concurrence locale dans la même ville**, avec les concurrents anonymisés.

> Note : la fonctionnalité de drill-down historique au clic sur un point est mise de côté pour l'instant — on traite uniquement le benchmark.

## Pourquoi c'est faisable

Les données existent déjà :
- 161 restaurants au total (106 Chicken Street + 55 Tasty Crousty)
- Tous ont une `city` renseignée
- **20+ villes** ont une présence des deux marques (Boulogne, Lyon, Marseille, Argenteuil, Aubervilliers, Créteil, Le Havre, Le Mans, Mulhouse, Montreuil, etc.)

## Comportement utilisateur

### 1. Toggle "Comparer au benchmark local" sur le scatter
Au-dessus du graphique "Visites vs Conversion", un nouveau switch :
**🎯 Benchmark local (même ville)** — désactivé par défaut.

Quand activé :
- Les points existants (ta marque) gardent leurs **couleurs vives** (Stars vert, Opportunités orange, Niches bleu, À surveiller rouge) et leur nom au survol.
- Les points **concurrents** (autres marques, mêmes villes) apparaissent en **gris clair semi-transparent**, **sans nom** au survol — juste "Concurrent local · [Ville]" + métriques anonymisées (visites, taux de conversion, commandes).
- Une nouvelle pastille de légende `⚪ Concurrents (X)` apparaît avec le compteur.

### 2. Encart d'analyse sous le scatter
Quand le toggle est ON, un petit encart résume :
> *"Sur les villes où vous êtes présent, X concurrents sont actifs. Votre taux de conversion moyen : **5.2%** vs **4.8%** pour la concurrence locale."*

Avec un mini-indicateur visuel (flèche ↑ verte ou ↓ rouge selon ton positionnement).

### 3. Filtrage géographique
Seules les villes où **ta marque est présente** déclenchent l'apparition de concurrents (on ne montre pas la concurrence d'une ville où tu n'es pas — pas pertinent).

## Architecture technique

### Données
- Reste sur la table `daily_conversion` déjà utilisée
- Nouvelle requête `localBenchmarkData` dans `src/pages/Analytics.tsx` :
  1. Récupère les villes des restaurants de la marque active (`SELECT DISTINCT city FROM restaurants WHERE chain_id = active`)
  2. Récupère les `restaurant_id` des **autres** marques situées dans ces mêmes villes (normalisation casse/espaces)
  3. Charge les `daily_conversion` de ces restaurants concurrents sur la période active
  4. Agrège visites/conversion par restaurant concurrent

### UI
- Nouveau prop `benchmarkData` sur `ConversionScatterPlot` : tableau de points anonymisés `{ city, visits, conversion, orders }` (sans `restaurantId` ni `restaurantName`)
- Rendu dans le scatter : superposer une seconde série Recharts `<Scatter>` au-dessus de la première, avec couleur grise et opacité réduite
- Tooltip personnalisé pour les concurrents : afficher uniquement "Concurrent · {ville}" + visites + taux
- Le toggle est local au composant (état `useState`), persisté en `localStorage` pour mémoriser la préférence

### Sécurité / Confidentialité
- Anonymisation **côté frontend ET backend** : la requête ne sélectionne que `restaurant_id` (jamais le nom), et au moment du rendu on remplace systématiquement par "Concurrent". Le `restaurant_id` reste utilisé en interne uniquement comme clé de regroupement, jamais affiché.
- Les politiques RLS actuelles permettent déjà de lire `daily_conversion` car le `super_admin` voit tout. **À valider : un utilisateur d'une seule marque pourra-t-il lire les `daily_conversion` d'une autre marque ?** Si non (politique restrictive), il faudra créer une **RPC `SECURITY DEFINER`** côté Supabase qui retourne uniquement des données agrégées et anonymisées sans exposer les `restaurant_id` réels. Je vérifierai ça en première étape de l'implémentation.

## Évolutions futures (hors-scope)
- Drill-down historique au clic sur un point (panneau latéral)
- Benchmark par rayon géographique (5km) au lieu de la ville
- Filtre par catégorie (poulet vs burger vs pizza) si plus de marques sont onboardées
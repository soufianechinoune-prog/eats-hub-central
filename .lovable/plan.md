## Refonte du Benchmark local

### Ce qui change

**Avant** : un toggle affichait des dizaines de points gris concurrents en arrière-plan → bruyant et peu lisible.

**Après** : on clique sur un de ses restaurants → un seul point gris apparaît à côté, représentant la **moyenne** des concurrents situés dans la même ville (ou même code postal en fallback). Comparaison 1-vs-marché, contextuelle et lisible.

### Comportement utilisateur

1. Vue par défaut : uniquement les restaurants de la marque active (Stars, Opportunités, Niches, À surveiller). Aucun point gris.
2. Clic sur un cercle (ex : "Chicken Street Boulogne") :
   - Le point cliqué reste mis en évidence (halo / bordure).
   - Un nouveau point gris apparaît, libellé "Moyenne concurrents · Boulogne (n=4)".
   - Une ligne pointillée relie les deux points pour visualiser l'écart.
   - Tooltip enrichi sur le point gris : ville, nombre de concurrents agrégés, visites moyennes, conversion moyenne, écart en points vs le restaurant cliqué.
3. Clic sur un autre restaurant : le benchmark précédent disparaît, un nouveau apparaît pour la nouvelle ville.
4. Clic dans le vide ou sur le même point : masque le benchmark.
5. Si moins de 2 concurrents trouvés : un petit message discret indique "Pas assez de données concurrentielles pour [Ville]" plutôt qu'un point trompeur.

### Logique de matching géographique

```text
Étape 1 : Ville normalisée
  - lowercase + sans accents (unaccent)
  - regroupement des arrondissements : "Lyon 6e" / "Lyon 06" / "Lyon 6ème" → "lyon"
                                        idem Paris, Marseille
  - on cherche tous les restaurants des autres chain_id
    avec la même ville normalisée
  
Étape 2 (fallback si <2 concurrents trouvés) : Code postal
  - on récupère le postal_code du restaurant cliqué
  - on cherche les concurrents avec le même postal_code exact
  
Étape 3 : Si toujours <2 concurrents → on n'affiche pas de benchmark
```

Le benchmark agrège ensuite sur la **période globale sélectionnée** (même filtre temporel que le scatter) :
- Moyenne des visites totales par restaurant concurrent
- Moyenne du taux de conversion (visites pondérées)

### Détails techniques

**1. Nouvelle RPC `get_restaurant_local_benchmark`** (remplace `get_local_benchmark_conversion`)

Paramètres :
- `p_restaurant_id uuid` (le restaurant cliqué)
- `p_start_date date`, `p_end_date date`

Retourne une seule ligne :
- `match_level text` : 'city' | 'postal_code' | 'none'
- `competitor_count int`
- `avg_visits numeric`
- `avg_conversion_rate numeric`
- `city text`, `postal_code text`

Logique SQL (SECURITY DEFINER) :
- Lit la `city` et `postal_code` du restaurant cible
- Normalise la ville (réutilise `normalize_resto_name` ou nouvelle fonction `normalize_city` plus adaptée — sans accents, sans arrondissements)
- Tente d'abord match ville normalisée, sinon code postal
- Agrège `daily_conversion` des restaurants matchés (autres `chain_id` uniquement) sur la période
- Calcule la moyenne par restaurant puis la moyenne des moyennes

**2. Modifications front**

- `ConversionScatterPlot.tsx` :
  - Supprimer le toggle "Benchmark local" et l'affichage de tous les concurrents
  - Ajouter un état `selectedRestaurantId` au clic sur un point
  - Au clic, fetch via React Query la RPC `get_restaurant_local_benchmark`
  - Afficher : point gris benchmark + ligne pointillée + tooltip dédié
  - Carte récap en bas remplacée par un encart contextuel : "Boulogne · 4 concurrents · Conv. moy. 3.2% (vous : 5.6%, +2.4 pt)"

- `Analytics.tsx` / `AnalyticsCharts.tsx` :
  - Retirer la query `localBenchmarkData` globale (plus besoin)
  - Le fetch se fait maintenant à la demande dans le composant scatter

**3. Suppression de l'ancienne RPC**

`get_local_benchmark_conversion` devient obsolète → drop dans la migration.

### Points d'attention

- Vérifier que la colonne `postal_code` existe sur `restaurants` (sinon fallback désactivé pour cette itération).
- La normalisation ville doit gérer Paris (1er-20e), Lyon (1er-9e), Marseille (1er-16e) → regex sur le pattern `\d+(er|e|ème|eme)?$`.
- Anonymat préservé : la RPC ne renvoie jamais de noms ni d'IDs de concurrents, uniquement des moyennes agrégées.
- Performance : 1 appel RPC par clic, très léger (agrégation sur quelques dizaines de restaurants max).

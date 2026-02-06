
# Adaptation de la page "Comparaison Notes" pour la Vue Réseau (100+ restaurants)

## Contexte

Tu as actuellement :
- **97 restaurants actifs** dans la base
- **4 restaurants épinglés** (pinned)
- **1 485 avis** dans le fichier hebdomadaire (tout le réseau)
- La page `/compare/ratings` **filtre uniquement les restaurants épinglés**

L'objectif est d'avoir une **Vue Réseau** complète pour les notes, adaptée à 100 restaurants.

---

## Structure de la page adaptée

| Section | Contenu | Comportement avec 100 restaurants |
|---------|---------|-----------------------------------|
| **KPIs Globaux** | Note moyenne réseau, Total avis, Uber Eats, Deliveroo | Agrégation de TOUS les restaurants |
| **Classement par note** | Tableau triable avec tous les restaurants | Pagination ou scroll infini |
| **Heatmap par période** | Vue condensée par groupe/Top performers | Limité à Top 20 ou groupes |
| **Distribution des notes** | Histogramme 1-5 étoiles réseau | Agrégation globale |
| **Tags les plus fréquents** | Top 10 tags positifs/négatifs réseau | Nouveau composant |

---

## Modifications techniques

### 1. Changer la source de données : Réseau complet

**Fichier** : `src/pages/RatingsComparison.tsx`

```
// AVANT (ligne 80-91)
const { data: pinnedRestaurants } = useQuery({
  queryFn: async () => {
    ...
    .eq("is_pinned", true)  // Filtre épinglés
  }
});

// APRES
const { data: allRestaurants } = useQuery({
  queryFn: async () => {
    ...
    .eq("is_active", true)  // Tout le réseau actif
  }
});
```

### 2. Ajouter un compteur réseau dans le header

```
Comparaison Notes - Vue Réseau
Analyse de 97 restaurants | 26 janv. - 1 févr. 2026
```

### 3. Limiter le Heatmap aux Top 20 performers

**Fichier** : `src/components/compare/RatingsHeatmapGrid.tsx`

Le composant existant fonctionne bien, mais avec 100 restaurants les lignes seraient illisibles. Solution :
- Afficher uniquement les **Top 20** restaurants par note moyenne
- Ajouter un bouton "Voir tout" qui ouvre une modale avec pagination

### 4. Améliorer le classement avec pagination

**Fichier** : `src/pages/RatingsComparison.tsx`

```
// Ajouter pagination pour le tableau de classement
const PAGE_SIZE = 25;
const [page, setPage] = useState(1);

const paginatedStats = restaurantStats.slice(
  (page - 1) * PAGE_SIZE, 
  page * PAGE_SIZE
);
```

### 5. Ajouter les Tags du réseau

Nouveau composant qui agrège les tags de tous les restaurants :

| Tag Positif | Occurrences |
|-------------|-------------|
| Ingrédients frais | 234 |
| Bien présenté | 189 |

| Tag Négatif | Occurrences |
|-------------|-------------|
| Demande non respectée | 45 |
| Trop lent | 23 |

---

## KPIs attendus avec ton fichier (1485 avis)

Basé sur l'analyse du CSV :

| KPI | Valeur estimée |
|-----|----------------|
| Note moyenne réseau | ~4.45/5 |
| Total avis | 1 485 |
| Restaurants avec avis | ~60+ |
| Avis 5 étoiles | ~60% |
| Tags positifs fréquents | `restaurant_convenient`, `restaurant_consistent` |
| Tags négatifs fréquents | `restaurant_not_tasty`, `restaurant_missed_request` |

---

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `src/pages/RatingsComparison.tsx` | Charger tous les restaurants actifs au lieu des épinglés, ajouter pagination |
| `src/components/compare/RatingsHeatmapGrid.tsx` | Limiter à Top 20, ajouter "Voir tout" |
| Nouveau : `src/components/compare/NetworkTagsAnalysis.tsx` | Analyse des tags réseau |

---

## Prochaines étapes

1. **Importer les avis** : Le fichier CSV doit être importé via `parse-reviews-order` pour que les données apparaissent
2. **Implémenter les changements** : Adapter la page pour charger tout le réseau
3. **Valider les seuils** : Définir les seuils de significativité (min 5 avis par restaurant)

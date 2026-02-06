
# Adaptation de la page "Comparaison Notes" pour la Vue Réseau (100+ restaurants)

## ✅ IMPLÉMENTÉ

### Contexte

- **97 restaurants actifs** dans la base
- **4 restaurants épinglés** (pinned)
- **1 485 avis** dans le fichier hebdomadaire (tout le réseau)
- La page `/compare/ratings` charge maintenant **tout le réseau actif**

---

## Structure de la page adaptée ✅

| Section | Contenu | Comportement avec 100 restaurants |
|---------|---------|-----------------------------------|
| **KPIs Globaux** ✅ | Note moyenne réseau, Total avis, Uber Eats, Deliveroo | Agrégation de TOUS les restaurants |
| **Classement par note** ✅ | Tableau triable avec tous les restaurants | Pagination (25 par page) |
| **Heatmap par période** ✅ | Vue condensée par groupe/Top performers | Limité à Top 20, bouton "Voir tout" avec modale |
| **Distribution des notes** ✅ | Histogramme 1-5 étoiles réseau | Agrégation globale |
| **Tags les plus fréquents** ✅ | Top 10 tags positifs/négatifs réseau | Nouveau composant NetworkTagsAnalysis |

---

## Modifications effectuées

### 1. ✅ Source de données : Réseau complet

**Fichier** : `src/pages/RatingsComparison.tsx`
- Chargement de tous les restaurants avec `is_active = true`
- Récupération des avis en batch (50 restaurants par requête)
- Filtrage des restaurants sans avis

### 2. ✅ Header avec compteur réseau

```
Comparaison Notes [Vue Réseau]
Analyse de 97 restaurants | 26 janv. - 1 févr. 2026
```

### 3. ✅ Heatmap limité aux Top 20

**Fichier** : `src/components/compare/RatingsHeatmapGrid.tsx`
- Affiche les 20 premiers restaurants par défaut
- Bouton "Voir les X autres restaurants" pour accéder à la liste complète
- Modale avec pagination (20 par page)

### 4. ✅ Classement avec pagination

**Fichier** : `src/pages/RatingsComparison.tsx`
- PAGE_SIZE = 25 restaurants par page
- Pagination avec navigation intelligente (affiche max 5 pages)
- Numérotation globale du rang préservée

### 5. ✅ Tags du réseau

**Nouveau composant** : `src/components/compare/NetworkTagsAnalysis.tsx`
- Agrège tous les tags de tous les restaurants
- Utilise les labels français de `src/lib/reviewTagLabels.ts`
- Sépare tags positifs et négatifs
- Affiche le Top 5 de chaque catégorie

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `src/pages/RatingsComparison.tsx` | ✅ Réseau complet + pagination |
| `src/components/compare/RatingsHeatmapGrid.tsx` | ✅ Top 20 + modale |
| `src/components/compare/NetworkTagsAnalysis.tsx` | ✅ Nouveau composant |

---

## Prochaines étapes

1. **Importer les avis** : Le fichier CSV doit être importé via l'outil d'import pour que les données apparaissent
2. **Valider les seuils** : Définir les seuils de significativité (min 5 avis par restaurant) si nécessaire
3. **Répliquer ce pattern** sur les autres pages de comparaison (Prep Time, Downtime, etc.)

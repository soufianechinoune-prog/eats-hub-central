

# Plan : Refonte UX/UI de la page Comparaison Notes

## Analyse de l'existant

En analysant les captures d'ecran et le code, j'identifie plusieurs problemes UX :

### Problemes identifies

| Zone | Probleme | Impact |
|------|----------|--------|
| Heatmap (droite) | Cases trop petites, noms tronques, pas de tri | Difficile de reperer les tendances |
| Graphique Uber vs Deliveroo | Affiche TOUS les restaurants (92!), labels illisibles | Inutilisable, pollution visuelle |
| Tableau de classement | Occupe 50% de l'espace mais duplique l'info du heatmap | Redundance |
| KPIs plateforme | Deliveroo affiche "0/5" (pas de donnees) | Confusion utilisateur |
| Distribution des notes | Bien fait, mais manque le contexte par restaurant |

### Benchmark interne

La page PrepTimeComparison est plus claire car elle utilise :
- Des barres horizontales de ranking (PrepTimeRankingBars)
- Une section insights textuelle (PrepTimeInsightsSection)
- Un heatmap comme vue secondaire

---

## Proposition de refonte

### 1. Reorganisation de la hierarchie visuelle

```text
+----------------------------------------------------------+
|  HEADER : Titre + Badge Vue Reseau + Selecteur Periode   |
+----------------------------------------------------------+
|  4 KPIs GLOBAUX (inchanges, mais masquer Deliveroo=0)    |
+----------------------------------------------------------+
|                                                          |
|  RANKING VISUEL (Barres horizontales)     | INSIGHTS     |
|  Top 10 meilleurs / 10 moins bons         | Textuels     |
|  Avec mini-sparkline de tendance          | (nouveau)    |
|                                                          |
+----------------------------------------------------------+
|                                                          |
|  HEATMAP (pleine largeur, scroll horizontal)             |
|  Tri par : Note moyenne / Nombre d'avis / Nom            |
|                                                          |
+----------------------------------------------------------+
|  DISTRIBUTION DES NOTES (bar chart)                      |
+----------------------------------------------------------+
|  ANALYSE DES TAGS RESEAU (inchange)                      |
+----------------------------------------------------------+
```

### 2. Supprimer le graphique Uber vs Deliveroo

Ce graphique avec 92 barres horizontales est illisible. Remplacer par :
- Un simple comparatif dans les KPIs (deja present)
- Ou un scatter plot si vraiment necessaire

### 3. Nouveau composant RatingsRankingBars

S'inspire de `PrepTimeRankingBars` existant. Affiche :
- Top 10 restaurants (vert → excellence)
- Flop 10 restaurants (orange/rouge → alerte)
- Format visuel : barres horizontales proportionnelles

### 4. Section Insights textuelle

Nouveau composant `RatingsInsightsSection` :
- "3 restaurants ont une note > 4.9"
- "Lyon 6eme a gagne +0.3 pts cette semaine"
- "Attention : 2 restaurants sous 4.5"

### 5. Ameliorations du Heatmap

- Largeur pleine (supprimer le tableau de gauche)
- Ajouter un tri interactif (par note, par volume, par nom)
- Cellules plus grandes avec valeurs arrondies
- Sticky header pour le scroll

### 6. KPIs dynamiques

- Masquer la carte Deliveroo si 0 avis
- Ajouter une icone de tendance vs periode precedente

---

## Fichiers a modifier/creer

| Action | Fichier | Description |
|--------|---------|-------------|
| Creer | `src/components/compare/RatingsRankingBars.tsx` | Barres Top/Flop |
| Creer | `src/components/compare/RatingsInsightsSection.tsx` | Insights textuels |
| Modifier | `src/components/compare/RatingsHeatmapGrid.tsx` | Pleine largeur + tri |
| Modifier | `src/pages/RatingsComparison.tsx` | Nouvelle mise en page |

---

## Maquette visuelle des Ranking Bars

```text
+-- Top 10 Restaurants --------------------------------+
|                                                      |
|  #1 Douai           ████████████████████████  5.0    |
|  #2 Toulouse        ███████████████████████▒  4.89   |
|  #3 Venissieux      ███████████████████████▒  4.88   |
|  ...                                                 |
|                                                      |
+-- Restaurants a surveiller --------------------------+
|                                                      |
|  #90 Paris X        ██████████████░░░░░░░░░  4.32    |
|  #91 Montreuil      █████████████░░░░░░░░░░  4.28    |
|  #92 Chatelet       ████████████░░░░░░░░░░░  4.15    |
|                                                      |
+------------------------------------------------------+
```

---

## Resume des changements

1. Suppression du tableau de classement (redondant avec heatmap)
2. Suppression du graphique Uber vs Deliveroo (92 barres = illisible)
3. Ajout de barres de ranking Top/Flop (pattern existant)
4. Ajout d'insights textuels (pattern existant)
5. Heatmap en pleine largeur avec options de tri
6. KPI Deliveroo conditionnel (masque si 0 donnees)

## Section technique

Les nouveaux composants suivront les patterns existants :
- `RatingsRankingBars` : clone de `PrepTimeRankingBars` adapte aux notes
- `RatingsInsightsSection` : clone de `PrepTimeInsightsSection` adapte aux notes
- Le heatmap passera de `lg:grid-cols-2` a pleine largeur
- Ajout d'un state `sortBy` dans le heatmap pour le tri interactif


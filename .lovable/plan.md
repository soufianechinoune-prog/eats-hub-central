

# Corriger la validation des fichiers volumineux (date range + compteurs)

## Problemes identifies

### 1. Periode des donnees incorrecte ("29/12/2024 au 06/01/2025" au lieu de "Jan 1 - Mar 30, 2025")
Le dry run n'envoie que les 1 000 premiers enregistrements du fichier. Comme le fichier est trie chronologiquement, l'echantillon ne couvre que la premiere semaine. La plage de dates affichee est celle du sample, pas du fichier complet.

### 2. Seulement 43 437 "A inserer" au lieu de ~387 000
L'extrapolation a la ligne 870 ne multiplie que `inserted` et `skipped` par le ratio. Le compteur `updated` (848) reste a sa valeur brute du sample au lieu d'etre extrapole. De plus, la liste des restaurants (1 seul detecte) ne represente que le sample.

### 3. Un seul restaurant detecte (Chicken Street - Athis-Mons)
Les 1 000 premiers enregistrements ne contiennent que des commandes de ce restaurant. Les autres restaurants du fichier ne sont pas visibles dans le dry run.

## Solution

### Fichier 1 : `src/pages/ReportImport.tsx`

**A. Extrapoler `updated` dans `handleValidate`** (ligne ~870)

Ajouter `updated` a la liste des compteurs extrapoles :
```text
Avant :
  inserted: Math.round(validationData.stats.inserted * ratio),
  skipped: Math.round(validationData.stats.skipped * ratio),

Apres :
  inserted: Math.round(validationData.stats.inserted * ratio),
  updated: Math.round(validationData.stats.updated * ratio),
  skipped: Math.round(validationData.stats.skipped * ratio),
```

**B. Scanner la date range sur tout le fichier cote client**

Au lieu de se fier au sample pour la plage de dates, parcourir le fichier complet cote client pour extraire la premiere et la derniere date. L'index de la colonne "Date de la commande" est detecte depuis le header, puis on lit cette colonne sur chaque enregistrement CSV-aware pour trouver min/max.

**C. Ajouter un indicateur "estimation" pour les fichiers volumineux**

Afficher clairement que les compteurs sont des estimations basees sur un echantillon. Ajouter un badge ou une note d'information sous les KPI pour eviter la confusion.

**D. Scanner les restaurants sur un echantillon representatif**

Au lieu de prendre les 1 000 premiers enregistrements (qui sont biaises car tries par date/restaurant), prendre un echantillon reparti uniformement sur tout le fichier (par exemple, 1 enregistrement tous les N enregistrements pour un total de 1 000). Cela donnera une meilleure representation des restaurants et du ratio insert/update.

## Details techniques

| Changement | Localisation dans le fichier |
|-----------|------------------------------|
| Ajouter `updated` a l'extrapolation | Ligne 870 dans `handleValidate` |
| Scan de dates sur fichier complet | Nouvelle fonction `scanDateRange()` appellee apres `parseCSVRecords` dans `handleValidate` |
| Echantillonnage uniforme | Modifier la logique lignes 830-833 pour un sampling reparti au lieu de sequentiel |
| Badge "estimation" | Dans le JSX de l'ecran de validation, a cote des compteurs |

## Resultat attendu

| Compteur | Avant | Apres |
|----------|-------|-------|
| Lignes totales | 387 445 | 387 445 |
| A inserer | 43 437 | ~340 000+ (extrapole correctement) |
| A mettre a jour | 848 | ~40 000+ (extrapole) |
| Periode | 29/12/2024 - 06/01/2025 | 01/01/2025 - 30/03/2025 (scan complet) |
| Restaurants | 1 (Athis-Mons) | Tous les restaurants du fichier |

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/pages/ReportImport.tsx` | Extrapoler `updated`, scan date range complet, echantillonnage uniforme, badge estimation |


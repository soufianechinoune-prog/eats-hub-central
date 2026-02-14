
# Activer le sampling et le chunking pour les commandes incorrectes

## Probleme

Le sampling (1 000 lignes pour validation) et le chunking (15 000 lignes par batch pour l'import) ne sont actuellement actives que pour le type `order_history`. Le fichier de commandes incorrectes (24 500 lignes) est envoye en un seul bloc, ce qui cause soit un timeout de l'Edge Function, soit un depassement memoire, resultant en seulement 1 000 lignes detectees au lieu de 24 514.

## Solution

Etendre le mecanisme de sampling + chunking existant aux imports de type `inaccurate_orders` (et potentiellement aux autres gros types de rapports).

## Details techniques

### Fichier : `src/pages/ReportImport.tsx`

#### 1. Validation (dryRun) - lignes ~743-754

Remplacer la condition `reportType === "order_history"` par une liste de types supportant les gros fichiers :

```text
const LARGE_FILE_REPORT_TYPES = ["order_history", "inaccurate_orders"];

if (LARGE_FILE_REPORT_TYPES.includes(reportType)) {
  // sampling des 1000 premieres lignes pour validation
  // + ajustement du totalRows affiche
}
```

#### 2. Import reel (chunking) - ligne ~906

Meme modification pour la condition de chunking :

```text
const needsChunking = LARGE_FILE_REPORT_TYPES.includes(reportType) && dataLinesCount > CHUNK_SIZE;
```

Ces deux changements suffisent a reutiliser toute l'infrastructure de chunking existante (barre de progression, agregation des stats, gestion des erreurs par chunk) pour les commandes incorrectes.

Aucun changement cote Edge Function n'est necessaire : le parser `parse-inaccurate-orders` recoit deja des morceaux de CSV et fonctionne correctement par batch grace a l'upsert.

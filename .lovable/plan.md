
# Corriger le chunking pour les fichiers avec en-tete decale

## Le probleme

Les fichiers CSV Uber Eats "Paiements (commandes)" ont souvent des lignes de metadonnees avant la vraie ligne d'en-tete. Par exemple :

```text
Ligne 0: "Rapport de paiements - Janvier 2026"   <-- metadonnee
Ligne 1: ""                                        <-- vide
Ligne 2: "Id. de la commande,Id. du flux,..."      <-- VRAI en-tete
Ligne 3: "abc123,flow456,..."                      <-- donnees
```

Le code de chunking dans `ReportImport.tsx` prend toujours `lines[0]` comme en-tete (ligne 919). Pour le chunk 1, ca fonctionne car le fichier original inclut les metadonnees + en-tete + donnees, et la fonction backend cherche l'en-tete dans les 20 premieres lignes. Mais pour les chunks 2 a 26, seule la ligne 0 (metadonnee) est ajoutee, et la fonction ne trouve pas les colonnes attendues.

Resultat : 25 chunks sur 26 echouent avec "Could not find header row" = 375 000 erreurs.

## La solution

Detecter la vraie ligne d'en-tete cote frontend avant de decouper en chunks, en utilisant la meme logique que la fonction backend (chercher les colonnes connues dans les premieres lignes).

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/pages/ReportImport.tsx` | Detecter l'index de l'en-tete reel avant le chunking (phases validation ET import) |

## Detail technique

### Nouvelle fonction de detection

Ajouter une fonction `findHeaderLineIndex` qui scanne les 20 premieres lignes pour trouver celle contenant des marqueurs connus (`Id. de la commande`, `Nom du restaurant`, `Date de la commande`, `UUID de la commande`, etc.) :

```text
function findHeaderLineIndex(lines: string[]): number {
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (lines[i] inclut un marqueur d'en-tete connu) return i;
  }
  return 0; // fallback: premiere ligne
}
```

### Modification phase validation (dry run) - autour ligne 751

Remplacer :
```text
const headerLine = lines[0];
const sampleLines = [headerLine, ...lines.slice(1, 1001)];
```

Par :
```text
const headerIndex = findHeaderLineIndex(lines);
const headerLine = lines[headerIndex];
const sampleLines = [headerLine, ...lines.slice(headerIndex + 1, headerIndex + 1001)];
```

### Modification phase import - autour ligne 919

Remplacer :
```text
const headerLine = lines[0];
const dataLines = lines.slice(1);
```

Par :
```text
const headerIndex = findHeaderLineIndex(lines);
const headerLine = lines[headerIndex];
const dataLines = lines.slice(headerIndex + 1);
```

Ainsi chaque chunk recevra la vraie ligne d'en-tete et la fonction backend pourra identifier les colonnes correctement.

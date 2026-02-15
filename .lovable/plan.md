

# Corriger le parsing CSV pour supporter les champs multi-lignes

## Diagnostic

Le fichier contient bien des centaines de milliers de commandes, mais le compteur "Lignes totales" est gonfle par les retours a la ligne contenus dans certains champs entre guillemets (notamment les URLs de factures Uber). Le parser actuel fait un `split('\n')` AVANT de parser les guillemets, ce qui casse les enregistrements multi-lignes :

```text
Ligne CSV correcte :
"#ABC12","uuid-1234","Chicken Street",..."https://invoice\nurl-suite",...

Apres split('\n') :
  Ligne 1: "#ABC12","uuid-1234","Chicken Street",..."https://invoice
  Ligne 2: url-suite",...
```

La Ligne 2 n'a plus de `uber_order_id` ni de `uber_store_id` → elle est skippee. Et le compteur de lignes est fausse.

Ce probleme existe a deux endroits :
1. **Le parser Edge Function** (`parseCSV` dans `parse-payment-report`)
2. **Le compteur client** dans `ReportImport.tsx` qui split aussi par `\n`

## Solution

### 1. Corriger `parseCSV()` dans le parser Edge Function

Remplacer la fonction `parseCSV` qui fait `csvText.split('\n')` par un parseur qui itere caractere par caractere sur tout le contenu CSV. Un `\n` rencontre a l'interieur de guillemets sera inclus dans la valeur du champ au lieu de creer une nouvelle ligne.

```text
function parseCSV(csvText):
  rows = []
  currentRow = []
  currentField = ""
  inQuotes = false

  for each char in csvText:
    if char == '"':
      if inQuotes and nextChar == '"':
        currentField += '"'  // escaped quote
        skip next
      else:
        toggle inQuotes
    else if char == ',' and not inQuotes:
      push currentField to currentRow
      reset currentField
    else if char == '\n' and not inQuotes:
      push currentField to currentRow
      if currentRow is not empty:
        push currentRow to rows
      reset currentRow and currentField
    else:
      currentField += char

  return rows
```

### 2. Corriger le compteur de lignes dans `ReportImport.tsx`

Ajouter une fonction `countCSVRecords()` qui compte les vrais enregistrements CSV (en respectant les guillemets) au lieu du simple `split('\n').length`. Utiliser cette fonction pour :
- Afficher le bon nombre de "Lignes totales"
- Calculer le bon ratio d'extrapolation pour le dry run
- Extraire les 1 000 premiers **enregistrements complets** pour l'echantillon (au lieu de 1 000 lignes brutes qui peuvent couper des enregistrements)

### 3. Impact attendu

| Avant | Apres |
|-------|-------|
| "Lignes totales : 387 445" | "Lignes totales : ~45 000" (le vrai nombre) |
| "A inserer : 43 437" (extrapolation faussee) | "A inserer : ~43 000" (ratio precis) |
| Lignes multi-lignes cassees et skippees | Toutes les commandes parsees correctement |

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/parse-payment-report/index.ts` | Remplacer `parseCSV()` par un parseur qui itere caractere par caractere et respecte les guillemets pour les `\n` |
| `src/pages/ReportImport.tsx` | Ajouter `countCSVRecords()` et `extractCSVRecords()` pour un comptage et echantillonnage CSV-aware ; mettre a jour `handleValidate` |

## Details techniques

La fonction `parseCSV` actuelle (lignes 119-152) sera entierement remplacee. La nouvelle version gere :
- Les retours a la ligne dans les champs entre guillemets (URLs de factures)
- Les guillemets echappes (`""`)
- Les retours chariot Windows (`\r\n`)
- Les lignes vides

Cote client, la detection de `headerIndex` (qui utilise aussi `split('\n')`) sera egalement corrigee pour utiliser le parsing CSV-aware, garantissant que l'en-tete est correctement identifie et que l'echantillon contient des enregistrements complets.

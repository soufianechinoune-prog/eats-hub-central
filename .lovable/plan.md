

## Problème actuel

Le gradient sur chaque `<td>` ne se synchronise pas visuellement — chaque cellule anime son propre gradient indépendamment, ce qui donne un effet "segmenté" au lieu d'un laser continu traversant toute la ligne.

Le problème fondamental : on ne peut pas faire un seul gradient traverser plusieurs `<td>` de manière synchronisée avec `background-position`. C'est une limitation CSS.

## Nouvelles propositions

### Option 1 — "Overlay div" (recommandée)
Au lieu de CSS pur, on ajoute un `<div>` overlay positionné en `absolute` **par-dessus la ligne entière** dans le composant React. Ce div contient le gradient animé et couvre toute la largeur de la ligne.

- On wrappe le contenu de la table dans un `position: relative` container
- On ajoute un `<div>` overlay animé positionné par rapport au `<tr>` (ou plutôt au parent de la table)
- Le gradient traverse réellement d'un seul tenant

### Option 2 — "Border-bottom glow"
Une fine ligne lumineuse (2-3px) qui glisse sous la row, comme un underline scanner. Plus subtil mais garanti sans segmentation.

- Utilise un `::after` sur le `<tr>` avec `height: 3px; bottom: 0` 
- Le gradient ne traverse qu'un seul élément = pas de segmentation

### Option 3 — "Row highlight + shimmer text"  
La ligne entière prend un fond doux `bg-primary/5` et le texte fait un effet shimmer (comme le loading skeleton). Simple, élégant, pas de problème de segmentation.

- Background uni sur les `<td>` (pas de gradient mobile)
- Shimmer CSS sur le texte via `background-clip: text`

---

## Recommandation : Option 2 — "Border-bottom glow"

C'est le meilleur compromis : un seul élément animé (pas de segmentation), visuellement clair comme un "scan", et léger techniquement.

**Implémentation :**

**1. `src/index.css`** — Remplacer le CSS BODACC actuel :
- `.bodacc-scanning` : `position: relative` sur le `<tr>` 
- `.bodacc-scanning::after` : barre lumineuse de 3px en bas, gradient qui glisse horizontalement en 1.5s
- Conserver les flash ok/alert sur les `<td>`

**2. Aucun changement React** — Les classes restent les mêmes (`bodacc-scanning`, `bodacc-scan-ok`, `bodacc-scan-alert`)

~15 lignes CSS modifiées, 0 fichier JS touché.


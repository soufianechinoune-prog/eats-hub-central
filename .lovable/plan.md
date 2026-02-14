
# Afficher le mapping interactif pour "Chicken Street - Lille"

## Probleme racine

Le fichier CSV contient 24514 lignes. Les 393 lignes de "Chicken Street - Lille" commencent vers la ligne 11373. Or :

1. **A la validation** (etape 3), seules les 1000 premieres lignes sont envoyees comme echantillon. "Lille" n'y figure pas, donc `unknownStoreIds` est vide et le composant de mapping ne s'affiche pas.

2. **A l'import** (etape 4), le fichier est decoupe en chunks. Chaque chunk retourne ses `unknownStoreIds`, mais le code d'agregation les ignore (`unknownStoreIds: []` en dur a la ligne 1027).

Resultat : le mapping interactif n'apparait jamais pour ce restaurant.

## Corrections prevues

### 1. Collecter les `unknownStoreIds` pendant le chunking

**Fichier** : `src/pages/ReportImport.tsx` (lignes ~1014-1029)

Dans la boucle d'agregation des chunks, ajouter la collecte des `unknownStoreIds` et `unknownStoreDetails` depuis chaque chunk, puis les injecter dans le resultat agrege au lieu de `[]`.

### 2. Afficher le mapping interactif sur l'ecran de resultat (etape 4)

**Fichier** : `src/pages/ReportImport.tsx` (vers l'etape "complete")

Ajouter le composant `UnknownStoreMapping` sur l'ecran de resultat d'import (etape 4), avec un bouton "Re-importer les lignes ignorees" une fois le mapping effectue. Ainsi, meme si la validation n'a pas detecte le probleme, l'utilisateur peut corriger apres l'import.

### 3. Hardcoder le match "Lille" -> "Lille Wazemmes" dans l'Edge Function (optionnel, raccourci)

**Fichier** : `supabase/functions/parse-inaccurate-orders/index.ts`

Comme vous savez que "Chicken Street - Lille" doit aller vers Lille Wazemmes, on peut aussi ajouter une regle de matching : quand il y a plusieurs candidats et que le nom extrait est exactement "lille", choisir le premier resultat par defaut plutot que de refuser le match. Mais le mapping interactif reste la solution propre et perenne.

## Resume

| Fichier | Changement |
|---------|-----------|
| `ReportImport.tsx` | Collecter `unknownStoreIds` dans l'agregation des chunks |
| `ReportImport.tsx` | Afficher `UnknownStoreMapping` a l'etape 4 (resultat) |
| Edge Function (optionnel) | Fallback quand matching ambigu |

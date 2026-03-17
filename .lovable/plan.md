

## Problème

Le nom du restaurant dans le mapping UI est tronqué par `truncate` CSS (ligne 207) et le conteneur `flex-1 min-w-0` est compressé par le Select `w-[200px]` à droite. Le nom complet ("Chicken Street - Goussainville") apparaît comme "Chicken Stre...".

## Corrections dans `src/components/reports/UnknownStoreMapping.tsx`

1. **Supprimer le `truncate`** sur le nom du restaurant (ligne 207) pour qu'il s'affiche en entier, en wrapping si nécessaire
2. **Passer le layout en colonne** (`flex-col` au lieu de `sm:flex-row`) pour donner plus de place au nom — ou simplement retirer le truncate et laisser le texte wrapper
3. **Afficher le store_id complet** en dessous du nom (actuellement tronqué à 12 chars) via un tooltip ou en entier en plus petit

Changements concrets :
- Ligne 207 : remplacer `truncate` par `break-words` pour permettre le retour à la ligne
- Ligne 202 : même chose pour le store_id, ou afficher plus de caractères
- Optionnel : ajouter un `title` attribut avec le nom complet en fallback tooltip natif


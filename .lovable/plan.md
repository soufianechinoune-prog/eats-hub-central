

# Plan : Stabiliser le champ Commission et améliorer son affichage

## Objectif
1. **Garder le champ Commission toujours visible** (mais désactivé en mode "Brut" pour éviter les décalages)
2. **Élargir le champ** pour afficher correctement les décimales (ex: 24.55%)

---

## Modifications techniques

### Fichier : `src/components/menu/ProfitabilityComparison.tsx`

#### 1. Commission toujours visible
Retirer la condition `{(viewMode === "margin" || marginType === "net") && (...)}` autour du bloc commission (lignes 664-719).

Le champ sera :
- **Actif** quand `marginType === "net"` (car le calcul en a besoin)
- **Désactivé/grisé** quand `marginType === "brut"` (champ présent mais non modifiable)

#### 2. Élargir le champ de saisie
Changer la largeur de l'input :
```diff
- className="w-16 pr-5 text-right h-7 text-xs"
+ className="w-20 pr-5 text-right h-7 text-xs"
```
Passer de `w-16` (64px) à `w-20` (80px) pour voir "24.55" confortablement.

#### 3. Style désactivé pour mode Brut
Ajouter une logique conditionnelle :
```tsx
<div className={cn(
  "flex items-center gap-1.5 border rounded-md px-2 py-1 bg-muted/30",
  marginType === "brut" && "opacity-50 pointer-events-none"
)}>
```
Le bloc devient semi-transparent et non-interactif en mode Brut.

#### 4. Indication visuelle claire
Optionnel : ajouter un attribut `disabled` sur l'input quand `marginType === "brut"` pour l'accessibilité.

---

## Résultat attendu

| Mode | Champ Commission |
|------|------------------|
| Brut | Visible, grisé, non modifiable |
| Net  | Visible, actif, modifiable |

L'interface ne "saute" plus entre les modes, et les valeurs décimales (ex: 24.55%) sont lisibles.


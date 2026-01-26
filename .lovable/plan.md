
# Correction du dropdown pour qu'il occupe toute la largeur

## Problème identifié

Le dropdown est coupé car le composant de base `select.tsx` a :
1. Un padding `p-1` sur le `Viewport` (ligne 80)
2. Un padding `pl-8 pr-2` sur le `SelectItem` (ligne 109)
3. Le `SelectPrimitive.ItemText` qui limite la largeur du contenu enfant

Même avec les classes CSS qu'on ajoute dans `OfferTypeHeader.tsx`, les styles de base du `select.tsx` prévalent.

## Solution

Modifier le composant `src/components/ui/select.tsx` pour ajouter une prop `viewportClassName` au `SelectContent` qui permet de surcharger le padding du Viewport.

Ensuite, dans `OfferTypeHeader.tsx`, passer `viewportClassName="p-0"` pour supprimer le padding.

---

## Modifications à apporter

### 1. Modifier `src/components/ui/select.tsx`

Ajouter une prop optionnelle `viewportClassName` au composant `SelectContent` :

```tsx
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    viewportClassName?: string;
  }
>(({ className, children, position = "popper", viewportClassName, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        // ... classes existantes
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          viewportClassName, // ← Permet de surcharger avec p-0
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
```

### 2. Modifier `src/components/menu/offers/OfferTypeHeader.tsx`

Utiliser `viewportClassName="p-0"` pour supprimer le padding interne :

```tsx
<SelectContent 
  align="start" 
  sideOffset={4}
  viewportClassName="p-0"
  className="w-[var(--radix-select-trigger-width)] p-0 border-0 shadow-lg rounded-lg overflow-hidden"
>
```

---

## Résumé des fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `src/components/ui/select.tsx` | Ajouter prop `viewportClassName` au `SelectContent` |
| `src/components/menu/offers/OfferTypeHeader.tsx` | Utiliser `viewportClassName="p-0"` |

---

## Résultat attendu

Les éléments de la liste déroulante occuperont maintenant 100% de la largeur du dropdown, identique au bandeau header, sans être coupés sur les côtés.

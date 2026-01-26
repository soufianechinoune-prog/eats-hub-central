
# Correction de la liste déroulante du sélecteur d'offres

## Problème identifié

Dans la capture d'écran, on voit que les éléments de la liste déroulante sont coupés sur la gauche et ne remplissent pas toute la largeur du bandeau. Cela vient du fait que :

1. Le `SelectItem` de Radix UI a un padding interne à gauche (pour l'indicateur de sélection)
2. Le contenu interne (`div`) n'occupe pas toute la largeur disponible

## Solution

Modifier le composant `OfferTypeHeader.tsx` pour que chaque élément de la liste déroulante :
- Occupe toute la largeur du dropdown
- N'ait pas de padding par défaut de Radix
- Ressemble exactement au bandeau header (avec bordures et couleurs)

## Modifications à apporter

**Fichier** : `src/components/menu/offers/OfferTypeHeader.tsx`

### 1. Corriger le SelectContent

Ajouter des styles pour forcer la largeur et supprimer le padding interne par défaut :

```tsx
<SelectContent 
  align="start" 
  className="w-[var(--radix-select-trigger-width)] p-0 border-0 shadow-lg rounded-lg overflow-hidden bg-background"
  sideOffset={4}
>
  <div className="flex flex-col">
    {/* Options ici */}
  </div>
</SelectContent>
```

### 2. Corriger le SelectItem

Le problème principal est que `SelectItem` a un `pl-8` par défaut pour l'indicateur de coche. Il faut :
- Forcer `pl-0` pour enlever ce padding
- Ajouter `w-full` directement sur le SelectItem
- S'assurer que le div interne prend bien toute la largeur

```tsx
<SelectItem 
  key={offer.id} 
  value={offer.id} 
  className="p-0 pl-0 pr-0 cursor-pointer focus:bg-transparent data-[highlighted]:bg-transparent [&>span:first-child]:hidden w-full"
>
  <div className="w-full px-4 py-4 sm:px-6 ...">
    {/* Contenu */}
  </div>
</SelectItem>
```

### 3. Ajouter une bordure entre les options

Pour que chaque option ressemble visuellement au bandeau header avec sa propre couleur de bordure :

```tsx
<div className={`w-full relative rounded-none first:rounded-t-lg last:rounded-b-lg ${offerColors.bg} border-b ${offerColors.border} last:border-b-0 ...`}>
```

## Résultat attendu

Chaque élément de la liste déroulante :
- Occupe 100% de la largeur (identique au bandeau header)
- A son propre fond coloré (orange, violet, emerald)
- A la même structure visuelle que le bandeau (icône + titre + description)
- N'est plus coupé sur les côtés


# Ajout d'explications pour les marges Brute et Nette

## Objectif
Rendre les concepts de marge **Brute** et **Nette** clairs et accessibles pour tous les utilisateurs, même non-experts en finance.

## Emplacement actuel
Le toggle se trouve dans la barre de filtres (lignes 519-536 de `ProfitabilityComparison.tsx`), avec deux boutons sans explication.

## Solution proposée

### 1. Ajout d'une icône Info avec tooltip détaillé

Ajouter une icône `Info` à côté du toggle avec un tooltip explicatif :

```text
┌──────────────────────────────────────────────────────────────┐
│  [ Brute ] [ Nette ]  ℹ️                                      │
│                       ↓                                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 📊 Marge Brute                                        │    │
│  │ = (Prix HT - Food Cost) / Prix HT                     │    │
│  │ Ce que vous gardez avant les commissions plateforme   │    │
│  │                                                        │    │
│  │ 📉 Marge Nette                                         │    │
│  │ = (Prix HT - Commission - Food Cost) / Prix HT        │    │
│  │ Ce qui reste vraiment après Uber/Deliveroo            │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 2. Contenu des explications

**Marge Brute :**
- Formule : `(Prix HT - Food Cost HT) / Prix HT × 100`
- Explication simple : "Ce que vous gardez avant de payer la plateforme"
- Utilité : Mesurer la performance intrinsèque du produit

**Marge Nette :**
- Formule : `(Prix HT - Commission - Food Cost HT) / Prix HT × 100`
- Explication simple : "Ce qui reste vraiment après Uber/Deliveroo"
- Utilité : Voir la rentabilité réelle après toutes les déductions

### 3. Design du tooltip

- Style : HoverCard ou Tooltip large avec formatage structuré
- Couleurs : Icônes en vert (brute) et violet (nette) pour différencier
- Taille : Assez large pour contenir les formules et explications

## Modification technique

**Fichier : `src/components/menu/ProfitabilityComparison.tsx`**

Envelopper le toggle existant dans un conteneur flex avec une icône `Info` qui déclenche un `HoverCard` explicatif :

```tsx
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

// Dans le JSX, autour du toggle existant (lignes 519-536) :
<div className="flex items-center gap-1.5">
  <div className="flex items-center gap-1 border rounded-md p-0.5">
    <Button variant={marginType === "brut" ? "default" : "ghost"} ...>Brute</Button>
    <Button variant={marginType === "net" ? "default" : "ghost"} ...>Nette</Button>
  </div>
  
  <HoverCard>
    <HoverCardTrigger asChild>
      <Button variant="ghost" size="icon" className="h-7 w-7">
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </HoverCardTrigger>
    <HoverCardContent className="w-80">
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-medium">
            <TrendingUp className="h-4 w-4" />
            Marge Brute
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            = (Prix HT − Food Cost) / Prix HT
          </p>
          <p className="text-xs text-muted-foreground">
            Ce que vous gardez avant les commissions plateforme
          </p>
        </div>
        
        <Separator />
        
        <div>
          <div className="flex items-center gap-2 text-violet-600 font-medium">
            <TrendingDown className="h-4 w-4" />
            Marge Nette
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            = (Prix HT − Commission − Food Cost) / Prix HT
          </p>
          <p className="text-xs text-muted-foreground">
            Ce qui reste vraiment après Uber/Deliveroo
          </p>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
</div>
```

## Résultat attendu

| Avant | Après |
|-------|-------|
| Toggle sans explication | Toggle + icône ℹ️ avec HoverCard détaillé |
| Utilisateurs confus | Formules et explications claires au survol |

## Fichier impacté
- `src/components/menu/ProfitabilityComparison.tsx`

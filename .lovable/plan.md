

# Afficher l'historique des UUID Uber Eats sur la fiche restaurant

## Contexte

La table `restaurant_uber_ids` stocke deja les UUID multiples par restaurant, avec un flag `is_primary`, un `label` (ex: "ancien compte (ferme 2025-06-11)") et un `created_at`. Certains restaurants ont change de societe/UUID, et il est utile de voir cette information directement sur la fiche pour analyser l'impact sur l'algorithme.

## Modification

### Fichier : `src/pages/RestaurantDetail.tsx`

**A. Ajouter une query pour fetcher les UUID historiques**

```typescript
const { data: uberIds = [] } = useQuery({
  queryKey: ["restaurant-uber-ids", id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("restaurant_uber_ids")
      .select("*")
      .eq("restaurant_id", id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },
  enabled: !!id,
});
```

**B. Modifier la section "Connexions API" (lignes 574-630)**

Sous le bloc Uber Eats existant (qui affiche le Store ID principal), ajouter la liste des UUID historiques issus de `restaurant_uber_ids` :

- Afficher chaque UUID avec son label et sa date `created_at`
- Le primaire est marque avec un badge "Actuel" (vert)
- Les secondaires avec un badge "Ancien" (gris) et leur label descriptif
- Format : UUID tronque + label + date d'ajout

```text
Connexions API
┌─────────────────────────────────────────────┐
│ Uber Eats                         Validé    │
│ Store ID: abc123-...                        │
│                                             │
│ Historique des UUID :                       │
│ ● abc123-def4... [Actuel]   depuis 2024-06  │
│ ○ xyz789-ghi0... [Ancien]   ferme 2025-06   │
│   "ancien compte (fermé 2025-06-11)"        │
└─────────────────────────────────────────────┘
```

Cela permet de voir d'un coup d'oeil si un restaurant a eu un changement d'UUID et quand, pour correler avec d'eventuels impacts sur les performances algorithmiques.

### Fichier modifie
- `src/pages/RestaurantDetail.tsx` (~30 lignes ajoutees)


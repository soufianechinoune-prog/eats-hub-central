
# Ajout de la multi-sélection pour suppression groupée des actions

## Objectif
Permettre de sélectionner plusieurs actions dans le tableau et de les supprimer en une seule fois, comme pour la page Restaurants.

## Aperçu de l'interface

```text
┌─────────────────────────────────────────────────────────────────┐
│ ☑  │ Plateforme │ Catégorie │ Action │ Période │ ... │ Actions │
├─────────────────────────────────────────────────────────────────┤
│ ☐  │ Uber       │ Menu      │ ...    │ ...     │ ... │ 🖊️ 🗑️   │
│ ☑  │ Toutes     │ Menu      │ ...    │ ...     │ ... │ 🖊️ 🗑️   │
│ ☑  │ Uber       │ Menu      │ ...    │ ...     │ ... │ 🖊️ 🗑️   │
│ ☐  │ Deliveroo  │ Promo     │ ...    │ ...     │ ... │ 🖊️ 🗑️   │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────┐
                    │  2 actions sélectionnées  │ 🗑️ Supprimer │ ✕ │
                    └─────────────────────────────────────────────┘
                                (barre flottante en bas)
```

## Modifications techniques

### 1. Nouveaux états pour la sélection

```typescript
// Dans RestaurantActions.tsx
const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
```

### 2. Checkbox dans l'en-tête du tableau (sélection globale)

Ajouter une colonne checkbox en première position du tableau :
- En-tête : checkbox "tout sélectionner / tout désélectionner" 
- Si toutes les actions filtrées sont sélectionnées : coché
- Si certaines mais pas toutes : état indeterminate
- Sinon : non coché

### 3. Checkbox par ligne

Chaque ligne aura une checkbox permettant de sélectionner/désélectionner l'action individuelle.

### 4. Barre d'actions flottante

Afficher une barre fixe en bas de l'écran quand au moins une action est sélectionnée :
- Compteur : "X action(s) sélectionnée(s)"
- Bouton "Supprimer" (rouge)
- Bouton fermer (X) pour désélectionner tout

### 5. Dialog de confirmation de suppression groupée

Modifier le dialog existant ou en créer un nouveau pour gérer la suppression de plusieurs actions :
- Titre : "Supprimer X actions ?"
- Liste des titres des actions à supprimer
- Appel API avec `supabase.from("restaurant_actions").delete().in("id", selectedIds)`

### 6. Gestion du state après suppression

- Vider la sélection après suppression réussie
- Rafraîchir la liste des actions

## Code des principales modifications

### Nouveau state
```typescript
const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
const [isBulkDeleting, setIsBulkDeleting] = useState(false);
```

### Fonctions helpers
```typescript
// Toggle une action
const toggleActionSelection = (actionId: string) => {
  setSelectedActionIds(prev => {
    const next = new Set(prev);
    if (next.has(actionId)) {
      next.delete(actionId);
    } else {
      next.add(actionId);
    }
    return next;
  });
};

// Sélectionner/désélectionner toutes les actions filtrées
const toggleAllActions = () => {
  const allFilteredIds = filteredActions.map(a => a.id);
  const allSelected = allFilteredIds.every(id => selectedActionIds.has(id));
  
  if (allSelected) {
    setSelectedActionIds(new Set());
  } else {
    setSelectedActionIds(new Set(allFilteredIds));
  }
};

// Suppression groupée
const handleBulkDelete = async () => {
  setIsBulkDeleting(true);
  const idsToDelete = Array.from(selectedActionIds);
  
  const { error } = await supabase
    .from("restaurant_actions")
    .delete()
    .in("id", idsToDelete);
  
  if (error) {
    toast({ title: "Erreur", description: "Impossible de supprimer les actions", variant: "destructive" });
  } else {
    toast({ 
      title: "Succès", 
      description: `${idsToDelete.length} action${idsToDelete.length > 1 ? 's' : ''} supprimée${idsToDelete.length > 1 ? 's' : ''}` 
    });
    setSelectedActionIds(new Set());
    fetchActions();
  }
  
  setIsBulkDeleting(false);
  setIsBulkDeleteDialogOpen(false);
};
```

### Nouvelle colonne dans TableHeader
```tsx
<TableHead className="w-[40px]">
  <Checkbox 
    checked={filteredActions.length > 0 && filteredActions.every(a => selectedActionIds.has(a.id))}
    onCheckedChange={toggleAllActions}
    aria-label="Sélectionner tout"
  />
</TableHead>
```

### Checkbox dans chaque TableRow
```tsx
<TableCell className="w-[40px]">
  <Checkbox 
    checked={selectedActionIds.has(action.id)}
    onCheckedChange={() => toggleActionSelection(action.id)}
    aria-label={`Sélectionner ${action.title}`}
  />
</TableCell>
```

### Barre flottante (similaire à RestaurantShareActions)
```tsx
{selectedActionIds.size > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border border-border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
    <span className="text-sm font-medium">
      {selectedActionIds.size} action{selectedActionIds.size > 1 ? 's' : ''} sélectionnée{selectedActionIds.size > 1 ? 's' : ''}
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsBulkDeleteDialogOpen(true)}
      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" />
      Supprimer
    </Button>
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={() => setSelectedActionIds(new Set())} 
      className="h-8 w-8"
    >
      <X className="h-4 w-4" />
    </Button>
  </div>
)}
```

### Dialog de confirmation
```tsx
<AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        Supprimer {selectedActionIds.size} action{selectedActionIds.size > 1 ? 's' : ''} ?
      </AlertDialogTitle>
      <AlertDialogDescription asChild>
        <div>
          <p className="mb-2">Cette action est irréversible. Les actions suivantes seront définitivement supprimées :</p>
          <ul className="list-disc list-inside text-sm space-y-1 max-h-[200px] overflow-y-auto">
            {actions.filter(a => selectedActionIds.has(a.id)).map(a => (
              <li key={a.id} className="font-medium">{a.title}</li>
            ))}
          </ul>
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isBulkDeleting}>Annuler</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleBulkDelete}
        disabled={isBulkDeleting}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {isBulkDeleting ? "Suppression..." : "Supprimer"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Fichiers impactés

| Fichier | Modifications |
|---------|---------------|
| `src/pages/RestaurantActions.tsx` | Ajout états, checkbox, barre flottante, dialog |

## Comportements additionnels

- La sélection se vide automatiquement si les filtres changent et que certaines actions sélectionnées sont filtrées
- Cliquer sur une ligne (hors checkbox) ne la sélectionne pas (garde le comportement actuel)
- Le bouton supprimer individuel reste disponible pour chaque ligne

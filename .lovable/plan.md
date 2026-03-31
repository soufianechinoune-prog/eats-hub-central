

## Objectif
Masquer la section "Pilotage" pour les utilisateurs avec le rôle "client", même pattern que "Données".

## Modification
**Fichier** : `src/components/layout/AppSidebar.tsx`

Wrapper le `<SidebarGroup>` "Pilotage" (lignes ~340-370) avec `{canImport && (...)}`.

`canImport` est déjà disponible dans le composant — retourne `true` pour `super_admin` et `importer`, `false` pour `client`.

**Avant :**
```tsx
<SidebarGroup>
  <SidebarGroupLabel>Pilotage</SidebarGroupLabel>
  ...
</SidebarGroup>
```

**Après :**
```tsx
{canImport && (
<SidebarGroup>
  <SidebarGroupLabel>Pilotage</SidebarGroupLabel>
  ...
</SidebarGroup>
)}
```

Une seule ligne ajoutée + une fermante. Aucun autre fichier modifié.




## Objectif
Restreindre les pages d'import/données aux rôles `super_admin` et `importer`. Les clients voient ni les liens ni les pages.

## Fichiers à créer/modifier

### 1. Créer `src/hooks/useUserRole.ts`
- `useUserRole()` : appelle `supabase.rpc('get_user_role')` avec react-query, staleTime 5min
- `useCanImport()` : retourne `true` si role === `super_admin` ou `importer`

### 2. Modifier `src/components/layout/AppSidebar.tsx`
- Importer `useCanImport`
- Wraper le groupe "Données" (lignes 458-483) dans `{canImport && (...)}` pour masquer entièrement la section pour les clients

### 3. Modifier `src/App.tsx`
- Créer un composant `ImportRoute` inline qui :
  - Appelle `supabase.rpc('get_user_role')`
  - Pendant le chargement → spinner ou null
  - Si role !== `super_admin` et !== `importer` → `Navigate to="/"` + toast "Accès restreint"
  - Sinon → render children
- Remplacer `<P>` par `<ImportRoute>` (wrappé dans `<P>`) pour les routes :
  - `/report-import`, `/data-entry`, `/import-checklist`, `/import-guide`
  - `/uber-mapping`, `/deliveroo-matching`
  - `/menu-items`, `/menu-history`

### Routes NON touchées
`/`, `/analytics/*`, `/restaurants/*`, `/messaging`, `/actions`, `/operations`, `/cartography`, `/marketing-analytics`, `/success-score`, `/admin`

## Aucune migration SQL nécessaire
Les fonctions `get_user_role()` et `is_super_admin()` existent déjà.


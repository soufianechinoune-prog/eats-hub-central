

## Objectif
Masquer le sélecteur de marques pour les clients — ils n'ont qu'une seule marque.

## Modification
**Fichier** : `src/components/layout/AppSidebar.tsx`

Le sélecteur de marques (lignes ~220-260) est actuellement affiché avec `{!collapsed && (...)}`. Ajouter la condition `canImport` pour le masquer si l'utilisateur est un client.

`useCanImport()` est déjà importé et utilisé dans le fichier.

Changement : `{!collapsed && (` → `{!collapsed && canImport && (`

Une seule ligne modifiée.


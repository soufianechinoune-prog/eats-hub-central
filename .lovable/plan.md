

## Objectif
Créer une page `/admin` super_admin-only pour gérer les utilisateurs (accès par marque) et les marques. Ajouter un lien conditionnel dans la sidebar.

## Contrainte technique : `supabase.auth.admin`
`supabase.auth.admin.createUser()` n'est **pas disponible côté client** (nécessite la service_role key). Il faut créer une **edge function** `admin-create-user` qui :
- Reçoit `{ email, password, role, chain_ids }`
- Vérifie que l'appelant est super_admin (via le JWT)
- Crée l'utilisateur avec `supabase.auth.admin.createUser()`
- Insère les entrées `user_chain_access`

De même, pour lister les emails des utilisateurs (auth.users n'est pas accessible via le SDK client), il faut une **edge function** `admin-list-users` qui retourne `{ id, email }[]` depuis `auth.admin.listUsers()`.

Pour supprimer un utilisateur, une edge function `admin-delete-user` supprimera l'entrée `user_chain_access` (et optionnellement le compte auth).

## Plan d'implémentation

### 1. Edge Function `admin-create-user`
- Fichier : `supabase/functions/admin-create-user/index.ts`
- Vérifie le JWT → appelle `is_super_admin()` via RPC
- `supabase.auth.admin.createUser({ email, password: "ChangeMe123!", email_confirm: true })`
- Insère dans `user_chain_access` pour chaque chain_id sélectionné
- Retourne le user créé

### 2. Edge Function `admin-list-users`
- Fichier : `supabase/functions/admin-list-users/index.ts`
- Vérifie le JWT → super_admin only
- `supabase.auth.admin.listUsers()` → retourne `[{ id, email }]`
- Joint avec `user_chain_access` et `chains` pour enrichir

### 3. Edge Function `admin-delete-access`
- Fichier : `supabase/functions/admin-delete-access/index.ts`
- Supprime l'entrée `user_chain_access` par id
- Super_admin only

### 4. Page `src/pages/Admin.tsx`
- Hook `useIsSuperAdmin()` : appelle `supabase.rpc('is_super_admin')`
- Si pas super_admin → redirect `/` + toast "Accès non autorisé"
- **Section 1 — Utilisateurs** :
  - Liste via edge function `admin-list-users` (email, rôle, marques, bouton supprimer)
  - Formulaire "Créer un compte" : email + rôle (importer/client) + multi-sélect marques → appelle `admin-create-user`
  - Formulaire "Attribuer accès" : email existant + rôle + marques → insère directement dans `user_chain_access`
- **Section 2 — Marques** :
  - Liste des chains avec count restaurants (query `chains` + count)
  - Formulaire créer marque (nom)
  - Bouton supprimer (si 0 restaurants)

### 5. Sidebar — lien conditionnel
- Dans `AppSidebar.tsx` : query `supabase.rpc('is_super_admin')` 
- Si true, afficher un lien "Admin" avec icône `Shield` dans le groupe du bas (avant Confidentialité)
- Si collapsed, afficher juste l'icône

### 6. Route dans `App.tsx`
- Ajouter `/admin` comme route protégée avec `AppLayout`

## Fichiers modifiés/créés
| Fichier | Action |
|---------|--------|
| `supabase/functions/admin-create-user/index.ts` | Créer |
| `supabase/functions/admin-list-users/index.ts` | Créer |
| `supabase/functions/admin-delete-access/index.ts` | Créer |
| `src/pages/Admin.tsx` | Créer |
| `src/components/layout/AppSidebar.tsx` | Modifier — ajouter lien Admin conditionnel |
| `src/App.tsx` | Modifier — ajouter route /admin |

## Aucune migration SQL nécessaire
Les tables et fonctions existent déjà.




## Objectif
Créer une page `/account` accessible à tous les utilisateurs connectés pour voir leur profil et changer leur mot de passe.

## Fichiers à créer/modifier

### 1. Créer `src/pages/Account.tsx`
- Card centrée style admin avec :
  - **Email** : `supabase.auth.getUser()` → affiché en lecture seule
  - **Rôle** : `supabase.rpc('get_user_role')` → Badge avec le rôle
  - **Marques** : query `user_chain_access` jointure `chains(name)` filtré par `auth.uid()` → liste de badges
  - **Section mot de passe** : 2 champs (nouveau + confirmation), validation min 8 chars + match, `supabase.auth.updateUser({ password })`, toast succès/erreur
- Wrappé dans `AppLayout`

### 2. Modifier `src/components/layout/AppSidebar.tsx`
- Ajouter import `User` depuis lucide-react
- Insérer un lien "Mon compte" (`/account`, icône `User`) juste avant le bouton "Déconnexion" (ligne ~554), visible pour tous les rôles

### 3. Modifier `src/App.tsx`
- Import `Account` + route protégée : `<Route path="/account" element={<P><AppLayout><Account /></AppLayout></P>} />`

## Point d'attention
- La query `user_chain_access` avec `chains(name)` fonctionne car la RLS permet aux users de voir leurs propres accès (via `user_has_chain_access`). Si ce n'est pas le cas, il faudra ajouter une policy SELECT sur `user_chain_access` pour `user_id = auth.uid()`. Je vérifierai les RLS existantes à l'implémentation.

## Aucune migration SQL nécessaire
Tout repose sur les fonctions et tables existantes.


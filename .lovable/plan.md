# Bug : un compte "client" se comporte comme un super_admin dans l'interface

## Diagnostic confirmé

`test-client@test.com` a bien le rôle **client** sur **Chicken Street uniquement** dans la base. Mais dans l'interface, il voit **toutes les marques** (101 restaurants), tous les onglets Analytics, toutes les sections sauf "Données" et "Pilotage".

**Cause racine** : la fonction SQL `get_user_role()` ne retourne un rôle **que si l'utilisateur a une ligne avec `chain_id IS NULL`** (cas réservé aux super_admin). Pour un client (qui a `chain_id = <id de Chicken Street>`), la fonction renvoie `null`. Conséquence : tout le frontend croit qu'il n'a "aucun rôle particulier" et lui montre l'interface complète.

Le RLS Supabase fonctionne correctement (le client ne peut pas lire les données des autres marques en base) — mais l'UI ne le sait pas et affiche les éléments visuels comme si tout était accessible.

## Ce que je vais corriger

### 1. Corriger la fonction SQL `get_user_role()`
Migration : si l'utilisateur a une ligne `chain_id IS NULL`, on renvoie ce rôle (super_admin). Sinon, on renvoie le rôle le plus "puissant" parmi ses accès marque (`importer` > `client`).

### 2. Restreindre le sélecteur de marque dans la sidebar
Dans `AppSidebar.tsx`, le menu "Toutes les marques / Chicken Street / TASTY CROUSTY" doit afficher uniquement les marques auxquelles l'utilisateur a réellement accès (déjà filtré par RLS côté requête `chains`, mais l'option "Toutes les marques" doit disparaître si l'utilisateur n'a accès qu'à une seule marque).

### 3. Forcer la sélection de marque pour un client
Si un client n'a accès qu'à une seule marque (cas le plus courant), on auto-sélectionne cette marque et on **masque le sélecteur** (au lieu d'afficher "Toutes les marques" qui n'a pas de sens pour lui).

### 4. Renforcer la garde sur `/admin`
Déjà OK (vérifié : `useIsSuperAdmin` redirige), mais je vais vérifier que la redirection se fait bien avant tout chargement de données.

### 5. Ajouter un badge "Lecture seule" dans la sidebar pour le rôle client
Petit indicateur visuel pour qu'on sache au premier coup d'œil dans quel mode on est connecté.

## Section technique

**Fichiers modifiés :**
- Nouvelle migration SQL : redéfinir `public.get_user_role()` pour gérer les rôles non-globaux
- `src/components/layout/AppSidebar.tsx` : filtrer le sélecteur de marque + badge rôle
- `src/contexts/AnalyticsContext.tsx` : si un seul `chain_id` accessible, l'auto-sélectionner et bloquer "Toutes les marques"
- `src/hooks/useUserRole.ts` : pas de changement nécessaire (le hook lit déjà la fonction SQL corrigée)

**SQL de la nouvelle `get_user_role()` :**
```sql
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_chain_access
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'importer' THEN 2
      WHEN 'client' THEN 3
      ELSE 4
    END
  LIMIT 1;
$$;
```

## Test après correction

Une fois appliqué, en se reconnectant avec `test-client@test.com` on doit voir :
- Une seule marque dans le sélecteur (Chicken Street, sélectionnée par défaut)
- 106 restaurants Chicken Street uniquement (au lieu de 101 toutes marques confondues)
- Pas d'option "Toutes les marques"
- Pas d'accès à `/admin`, `/data-entry`, `/report-import`, etc.
- Badge "Lecture seule" visible dans la sidebar



## Objectif
Sécuriser l'app en ajoutant une authentification obligatoire : page `/login` (login uniquement, pas d'inscription) + protection de toutes les routes via un guard basé sur la session Supabase.

## Problème actuel
- La route `/auth` redirige vers `/` (ligne 72 de App.tsx) — la page Auth.tsx n'est jamais utilisée
- Aucune vérification de session nulle part — l'app est accessible sans login
- Le bouton déconnexion existe dans la sidebar mais ne redirige pas vers `/login`

## Plan de correction

### 1. Créer `src/pages/Login.tsx` (nouveau fichier)
- Login uniquement (email + mot de passe), PAS d'inscription publique
- `supabase.auth.signInWithPassword()` 
- Gestion d'erreurs avec toast
- Style cohérent : fond sombre, Card centrée, titre "CS Performance"
- Redirection vers `/` après connexion réussie

### 2. Créer `src/components/auth/ProtectedRoute.tsx` (nouveau fichier)
- Utilise `supabase.auth.getSession()` au montage pour vérifier la session
- Écoute `supabase.auth.onAuthStateChange()` pour les changements (logout, expiration)
- 3 états : `loading` (splash/spinner), `authenticated` (render children), `unauthenticated` (Navigate vers `/login`)
- Stocke la session dans un state React

### 3. Modifier `src/App.tsx`
- Supprimer l'import de Auth.tsx
- Importer Login et ProtectedRoute
- Route `/login` → `<Login />` (publique)
- Route `/auth` → `<Navigate to="/login" />` (rétrocompat)
- Wrapper TOUTES les autres routes avec `<ProtectedRoute>` sauf `/login`, `/privacy-policy`, `/auth/uber/callback`, `/uber-callback`

### 4. Modifier `src/components/layout/AppSidebar.tsx`
- Dans `handleLogout`, après `signOut()` réussi, ajouter `navigate("/login")`

### 5. Supprimer `src/pages/Auth.tsx`
- Plus utilisé, remplacé par Login.tsx

## Détails techniques

**ProtectedRoute** (pattern) :
```typescript
const [session, setSession] = useState<Session | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  // Set up listener FIRST
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setLoading(false);
    }
  );
  // Then check current session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setLoading(false);
  });
  return () => subscription.unsubscribe();
}, []);

if (loading) return <LoadingSpinner />;
if (!session) return <Navigate to="/login" replace />;
return children;
```

**Login.tsx** — login only, no signup toggle, style dark/cohérent.

**Routes publiques** (non protégées) : `/login`, `/privacy-policy`, `/auth/uber/callback`, `/uber-callback`

## Résultat attendu
- Tout accès non authentifié redirige vers `/login`
- Après login, accès normal à l'app
- Après déconnexion, retour à `/login`
- Pas d'inscription publique (comptes créés dans le backend)




## Plan : Landing page publique sur "/"

### Principe
- Nouveau composant `src/pages/Landing.tsx` : page vitrine complète
- Modification de `src/App.tsx` : la route "/" affiche un composant `SmartHome` qui check la session :
  - Non connecte → `Landing`
  - Connecte → redirige vers `/overview`

### Fichiers modifies

**1. `src/pages/Landing.tsx`** (nouveau)

Page statique responsive avec 5 sections :
- **Header** : titre "Delivery Performance" + bouton "Se connecter" → `/login`
- **Hero** : titre/sous-titre + 2 CTA (mailto demo + login)
- **Chiffres cles** : 3 cartes (147 restos, 2 plateformes, temps reel)
- **Fonctionnalites** : 3 colonnes avec icones Lucide
- **Confiance** : Chicken Street + Tasty Crousty
- **Footer** : copyright Opineo, lien privacy, contact

Style : palette existante (primary violet, accent vert), composants Card/Button existants, gradient hero, responsive grid.

**2. `src/App.tsx`**

```text
Avant :  <Route path="/" element={<P><AppLayout><Overview /></AppLayout></P>} />
Apres :  <Route path="/" element={<SmartHome />} />
         <Route path="/overview" element={<P><AppLayout><Overview /></AppLayout></P>} />
```

`SmartHome` : petit composant inline qui utilise `supabase.auth.getSession()` pour rediriger vers `/overview` si connecte, sinon affiche `Landing`.

**3. Sidebar + liens internes**

Verifier que les liens internes (sidebar, redirections post-login) pointent vers `/overview` et non `/`.

### Aucune migration SQL, aucun changement backend.


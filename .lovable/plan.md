

## Objectif
Ajouter la fonctionnalité "Mot de passe oublié" : lien sur /login, envoi d'email de reset, page /reset-password pour saisir le nouveau mot de passe.

## Fichiers à modifier/créer

### 1. `src/pages/Login.tsx` — Ajouter le lien "Mot de passe oublié ?"
- Ajouter une fonction `handleForgotPassword` :
  - Si `email` vide → toast "Entrez votre email d'abord"
  - Sinon → `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://cs-delivery-performance.com/reset-password' })`
  - Succès → toast "Email de réinitialisation envoyé"
  - Erreur → toast avec message
- Ajouter un bouton texte sous le bouton "Se connecter" : `"Mot de passe oublié ?"`

### 2. Créer `src/pages/ResetPassword.tsx`
- Style identique à Login.tsx (Card centré, même structure)
- Vérifie la présence du hash `type=recovery` dans l'URL au mount (Supabase gère la session automatiquement via le token dans le fragment)
- 2 champs : "Nouveau mot de passe" + "Confirmer le mot de passe"
- Validation : min 8 caractères, les 2 champs doivent correspondre
- Appel `supabase.auth.updateUser({ password })` 
- Succès → toast "Mot de passe mis à jour" + `navigate("/")`
- Erreur → toast avec message

### 3. `src/App.tsx` — Ajouter la route publique
```tsx
<Route path="/reset-password" element={<ResetPassword />} />
```
Ajoutée dans la section des routes publiques (à côté de `/login`, `/privacy-policy`).

## Aucune migration SQL nécessaire
Utilise uniquement les fonctions Auth intégrées.


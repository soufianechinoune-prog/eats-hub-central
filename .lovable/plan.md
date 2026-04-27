## Contexte

L'erreur `invalid_scope` apparaît **après** que l'utilisateur ait validé son login Uber (donc Uber a accepté d'afficher l'écran d'autorisation, mais refuse à la dernière étape). Cela invalide l'hypothèse "scope non activé sur l'app". Le vrai blocage se trouve soit côté **compte utilisateur** (pas le bon type), soit côté **scope inadapté**, soit côté **type d'application Uber** mal configuré.

## Plan en 3 étapes

### Étape 1 — Diagnostic précis (capturer le vrai message d'Uber)

Modifier `src/pages/UberCallback.tsx` pour :
- Afficher en évidence `error_description` (pas juste `error`)
- Afficher tous les `searchParams` reçus (utile pour voir si Uber renvoie des hints supplémentaires)
- Logger côté console le payload complet pour debug

Cela permettra en 1 essai de savoir **exactement** pourquoi Uber refuse.

### Étape 2 — Essayer le bon scope pour ton cas d'usage

`eats.pos_provisioning` est conçu pour les **fournisseurs de caisse** (POS providers). Ton cas d'usage est de **lire les données de rapport pour plusieurs restaurants d'un même manager**. Le scope adapté est :

- **`eats.store`** : permet de lister les restaurants du compte connecté
- **`eats.report`** : déjà obtenu côté server-to-server, peut aussi être obtenu en flow user

Dans `supabase/functions/uber-auth/index.ts`, changer :
```typescript
const scopes = "eats.store eats.report";
```

Si Uber renvoie encore `invalid_scope`, on saura que c'est l'app qui n'est pas habilitée pour ces scopes en flow user.

### Étape 3 — Checklist de vérification côté portail Uber Developer

Te fournir une checklist courte à valider sur https://developer.uber.com/dashboard :

1. **App Type** → vérifier qu'elle supporte "Authorization Code Grant" (pas seulement "Client Credentials")
2. **Redirect URIs** → vérifier que `https://cs-delivery-performance.com/uber-callback` est listée **exactement** (incluant le `https://`, pas de slash final)
3. **Scopes** → onglet "Authorizations" → vérifier la colonne "User-authorized scopes" et noter lesquels sont `Active`
4. **Sandbox vs Production** → vérifier que le client_id `wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX` n'est pas un client Sandbox tentant un flow Production
5. **Type de compte testeur** → confirmer que le compte Uber utilisé pour le login a bien le rôle "Manager" sur au moins un restaurant Uber Eats

## Plan B si ça ne marche toujours pas

Si après les étapes 1–3 Uber refuse toujours, on bascule sur l'**approche manuelle** : tu (super_admin) ajoutes les UUIDs des restaurants directement dans l'UI sans flow OAuth utilisateur. On a déjà tout le code côté `client_credentials` qui marche pour récupérer les rapports. Ça prend 1h à brancher pour 50 restaurants et c'est 100% fiable.

## Fichiers impactés (étapes 1 & 2)

- `src/pages/UberCallback.tsx` — afficher error_description complète
- `supabase/functions/uber-auth/index.ts` — changer le scope vers `eats.store eats.report`

## Ce que tu vas devoir me dire après le prochain test

Une fois le code mis à jour et un nouveau test effectué :
1. Le **`error_description` complet** affiché à l'écran
2. La capture d'écran de l'écran Uber **juste avant** le clic "Autoriser" (s'il y a une liste de permissions affichée, je veux la voir)
3. Le résultat de la checklist Uber Developer (étape 3)

Avec ces 3 infos, on saura à 99% quelle est la vraie cause et on pourra la fixer en 1 itération.



# Fix : SIRET validation toujours "non trouvé"

## Probleme identifie

Les logs reseau montrent clairement le probleme : les appels directs depuis le navigateur vers `entreprise.data.gouv.fr` echouent avec **"Load failed"** -- c'est un probleme **CORS**. Cette API ne permet pas les appels cross-origin depuis un navigateur.

Le composant `SiretValidation.tsx` (ligne 33-34) appelle directement l'API depuis le client, ce qui est bloque par le navigateur.

## Solution

Passer par une **edge function** (comme on l'a fait pour `check-eco-organism`) pour proxifier l'appel.

### 1. Creer `supabase/functions/validate-siret/index.ts`
- Recoit un SIRET en POST
- Appelle `https://entreprise.data.gouv.fr/api/sirene/v3/etablissements/{siret}` cote serveur (pas de CORS)
- Retourne les infos (denomination, adresse, etat)

### 2. Modifier `SiretValidation.tsx`
- Remplacer le `fetch` direct par un appel a la edge function via le client Supabase (`supabase.functions.invoke('validate-siret', { body: { siret } })`)

### Fichiers
- **Nouveau** : `supabase/functions/validate-siret/index.ts`
- **Modifie** : `src/components/restaurants/SiretValidation.tsx`


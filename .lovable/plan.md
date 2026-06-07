## TL;DR

**Non, tu n'as pas à reconnecter Splash.** Splash360 est déjà actif en base pour Chicken Street et le sync tourne (5400 lignes upsertées à 11:04, et toutes les 30 min ensuite via le cron).

L'écran qui te montre « Connecter » pour les deux cartes est un **bug d'affichage** côté front, dont je dois patcher.

## Cause du bug

Le hook `useActiveChainPOSConnection()` (utilisé par `/settings/integrations`) fait :

```ts
.eq("chain_id", selectedChainId)
.eq("is_active", true)
.maybeSingle()
```

Il suppose **une seule** connexion active par marque. Depuis qu'on autorise Splash + Dishop ensemble, la requête retourne 2 lignes → `.maybeSingle()` renvoie une erreur silencieuse → aucune carte n'est marquée « Connectée » → le bouton « Connecter » s'affiche partout, comme si rien n'était branché.

Côté connexion en base : c'est OK, Splash + Dishop sont bien tous les deux `is_active=true`.

## Plan

### 1. Refactor `usePOSConnectors.ts` — supporter plusieurs connexions actives par marque

- Renommer `useActiveChainPOSConnection()` → `useActiveChainPOSConnections()` (pluriel), retourner **un tableau** (sans `.maybeSingle()`).
- Ajouter un helper `useActiveChainPOSConnectionByConnector(connectorId)` qui fait `.find()` dans le tableau, utilisé par chaque carte.
- Corriger `useConnectPOS()` : ne plus faire `UPDATE … SET is_active=false WHERE chain_id=…` (ça désactivait tout). Désactiver uniquement les connexions du même `connector_id`.
- Corriger `useDisconnectPOS()` : passer en paramètre l'ID de la connexion à déconnecter (au lieu de tout désactiver d'un coup). Signature `mutateAsync(connectionId)`.

### 2. Adapter la page `Integrations.tsx`

- Remplacer `activeConnection` (singulier) par une lookup par carte : `const conn = connectionsByConnector[c.id]`.
- Badge global header « Caisse connectée » → afficher une liste : « Splash360 + Dishop connectées » si plusieurs.
- Bouton « Déconnecter » → passer `conn.id` à `disconnect.mutateAsync()`.
- Boutons Sync / Backfill / Test Dishop → utiliser la `conn` de la carte courante.
- Garder le tri : connecteurs actifs d'abord, puis available, puis coming_soon.

### 3. Vérification

- Recharger `/settings/integrations` sur Chicken Street : Splash360 ET Dishop doivent afficher le badge « Connectée » + la date de dernière synchro pour Splash.
- Vérifier sur TASTY CROUSTY : seul Splash360 « Connectée », Dishop « Connecter » (pas de Dishop CS).
- Re-tester un cycle « Déconnecter Dishop » → seul Splash reste actif → re-cliquer « Connecter » sur Dishop fonctionne sans casser Splash.

## Détails techniques

- Aucune migration SQL nécessaire (la contrainte d'index a déjà été corrigée tout à l'heure).
- 2 fichiers modifiés : `src/hooks/usePOSConnectors.ts` et `src/pages/Integrations.tsx`.
- Pas d'impact sur l'edge function `sync-splash360` ni `dishop-api`.
- L'invalidation `queryKey: ["chain_pos_connection"]` doit devenir `["chain_pos_connections"]` (pluriel).

## Objectif

Remettre les 3 scopes Uber d'origine dans le flux OAuth Authorization Code afin de tester ce que le portail Uber autorise réellement à l'écran de consentement marchand.

## Changement

**Fichier** : `src/components/restaurants/UberConnectionSection.tsx`

**Modification unique** :

```ts
// Avant (état actuel)
const UBER_SCOPES = "eats.report";

// Après
const UBER_SCOPES = "eats.store eats.store.orders.read eats.report";
```

Aucun autre changement nécessaire — le reste du flux OAuth (redirect URI, state, callback handling) reste identique.

## Procédure de test (après déploiement)

1. Aller sur la fiche d'un restaurant en **production** (`https://cs-delivery-performance.com/restaurants/...`)
2. Cliquer "Connecter Uber Eats"
3. Observer l'écran de consentement Uber :
   - **Cas A** — Les 3 permissions s'affichent et l'acceptation fonctionne → callback OK → on garde les 3 scopes ✅
   - **Cas B** — Uber affiche une erreur `invalid_scope` ou redirige avec `error=invalid_scope&error_description=...` → on retire le(s) scope(s) refusé(s) et on retombe progressivement (d'abord retirer `eats.store`, puis `eats.store.orders.read` si nécessaire)
4. Vérifier dans la table `uber_connections` que la colonne `scope` contient bien ce qui a été accordé par Uber (Uber peut renvoyer un sous-ensemble des scopes demandés dans la réponse token)

## Point de vigilance

Uber peut accepter le consentement mais ne renvoyer qu'un **sous-ensemble** des scopes dans la réponse `/oauth/v2/token` (champ `scope`). Le `UberCallback.tsx` actuel stocke bien ce champ tel que retourné, donc on aura la vérité terrain dans la base après le test.

## Suite logique selon résultat

- Si les 3 passent → on pourra commencer à exploiter `eats.store.orders.read` pour du tracking de commandes en temps réel (vs les CSV actuels)
- Si seul `eats.report` passe → on remet la valeur réduite et on reste sur le modèle CSV/reports actuel

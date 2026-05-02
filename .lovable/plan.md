# Plan — Aligner le code sur les scopes Uber confirmés

## Contexte

Uber (Sanjay) confirme officiellement que **seuls 3 scopes sont activés** sur le client ID prod `wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX` :

- `eats.report`
- `eats.store`
- `eats.store.orders.read`

Les scopes `eats.store.status.write` et `eats.order` ne sont **pas** activés → c'est ce qui causait `invalid_scope` dans nos tests.

## Diagnostic des fichiers actuels

| Fichier | Scopes demandés | État |
|---|---|---|
| `uber-create-report/index.ts` | `eats.report` (client_credentials) | ✅ Correct, devrait marcher |
| `test-uber-scopes/index.ts` | Les 5 scopes (incluant les 2 non activés) | ⚠️ À nettoyer |
| `uber-auth/index.ts` (OAuth user) | `eats.store eats.report` | ✅ OK |
| `uber-validate-store/index.ts` | `eats.report` | ✅ OK |

Note technique : `test-uber-scopes` utilise `login.uber.com`, `uber-create-report` utilise `auth.uber.com`. Les deux sont des alias officiels Uber, on garde tel quel.

## Modifications

### 1. `supabase/functions/test-uber-scopes/index.ts`
Réduire `CLIENT_CREDENTIAL_SCOPES` aux 3 scopes confirmés activés :
```ts
const CLIENT_CREDENTIAL_SCOPES = [
  "eats.store",
  "eats.store.orders.read",
  "eats.report",
];
```
Et retirer les 2 scopes non activés (`eats.store.status.write`, `eats.order`).

→ Le test renverra désormais `available: true` pour les 3, sans pollution `invalid_scope`.

### 2. Aucune modification à `uber-create-report`
Le code actuel demande déjà uniquement `eats.report` → il devrait fonctionner.

## Étapes d'exécution (après approbation)

1. Modifier `test-uber-scopes/index.ts` (scopes réduits à 3).
2. Déployer `test-uber-scopes` + `uber-create-report` (si pas déjà à jour).
3. Lancer `test-uber-scopes` → vérifier que les 3 scopes renvoient `200 / available: true`.
4. Lancer `uber-create-report` avec **Chicken Street Montreuil + février 2026** (`PAYMENT_DETAILS_REPORT`, `start_date=2026-02-01`, `end_date=2026-02-28`).
5. Lire les logs `uber-create-report` et te montrer :
   - Le token obtenu (status)
   - La réponse Uber `/v1/eats/report` (workflow_id ou erreur)
6. Si succès → on aura le `workflow_id` et le webhook livrera le CSV.
7. Si échec → on saura précisément à quelle étape ça bloque (token vs API report).

## Réponse à donner à Uber

Pas besoin de leur répondre côté scopes : on confirme juste qu'on n'utilisera plus que les 3 activés. Si on a besoin un jour de `eats.order` ou `eats.store.status.write` (commandes / pause magasin), on pourra leur redemander à ce moment-là.

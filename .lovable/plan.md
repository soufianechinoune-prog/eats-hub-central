# Plan — Tests diagnostiques Uber OAuth

## Objectif

Trancher entre 3 hypothèses pour le `invalid_scope` persistant :
1. Bug Uber côté provisioning (mail à Sanjay justifié)
2. Mauvais format de requête (scopes individuels au lieu de combinés)
3. Mauvais `client_secret` configuré côté Lovable Cloud

## Modification

Étendre `supabase/functions/test-uber-scopes/index.ts` avec 4 tests supplémentaires en plus des 3 scopes individuels déjà testés :

- **TEST A** — Demander les 3 scopes **combinés** dans une seule requête (`scope=eats.store eats.store.orders.read eats.report`)
- **TEST B** — Requête avec un `client_secret` volontairement **invalide** + scope `eats.report` → si Uber renvoie `invalid_client` au lieu de `invalid_scope`, ça prouve que notre secret est bon
- **TEST C** — Requête `client_credentials` **sans aucun scope** → voir le comportement par défaut
- **TEST D** — Sortir le préfixe + longueur du `client_id` configuré (sanity check pour vérifier qu'on utilise bien le bon ID prod, sans dévoiler le secret)

## Étapes

1. Modifier `test-uber-scopes/index.ts` (ajout de la helper `tryToken` et des 4 tests).
2. Déployer la fonction.
3. L'appeler via curl_edge_functions et te montrer le résultat brut des 7 tests.
4. Conclure :
   - Si TEST A passe → on doit demander les scopes combinés, pas isolés (fix code).
   - Si TEST B renvoie `invalid_client` → secret OK, c'est bien Uber.
   - Si TEST B renvoie `invalid_scope` → secret peut-être faux OU Uber renvoie ce code à tort.
5. Sur la base de ces résultats, soit on corrige le code de `uber-create-report`, soit on envoie le mail à Sanjay avec preuves.

Aucun code applicatif (UI, RPC, DB) n'est touché, uniquement la fonction de diagnostic.

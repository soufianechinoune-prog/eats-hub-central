# Ajout de `commission_uber_ht` à l'API hebdomadaire Uber (v2)

Plan v2 intégrant les 3 réserves de l'ingénieure — toutes légitimes.

## Constat après vérification base

La colonne HT est **déjà stockée** dans `orders.uber_fee_after_promo_excl_vat`. Le `COUNT` montre 100 % de non-NULL sur 2023 → 2026 (~5,1 M lignes). Mais **non-NULL ≠ cohérent** : la vraie validation viendra du protocole de test ci-dessous, pas de ce chiffre.

Aucun backfill de données n'est prévu — c'est à confirmer par les tests, pas à affirmer.

## Ce qui va changer

**API** — 1 champ ajouté (on passe de 6 à 7). Convention identique à `commission_uber` (négatif, ≤ 0).

| Champ API | Colonne CSV Uber | Signe |
|---|---|---|
| `commission_uber` (existant) | Marketplace Fee after discount (incl VAT) | ≤ 0 |
| **`commission_uber_ht`** (nouveau) | Uber Service Fee after discount (excluding VAT) | ≤ 0 |

Le champ apparaîtra dans les 4 granularités (`network`, `by_day`, `by_restaurant`, `by_day_restaurant`) et dans les totaux de `list=1`.

## Étapes techniques

1. **Migration RPC `get_weekly_uber_report`** : ajouter `commission_uber_ht` construit **par copier-coller de l'expression `commission_uber` existante**, en changeant uniquement la colonne source (`uber_fee_after_promo_excl_vat` au lieu de `uber_fee_after_promo_incl_vat`). Même `COALESCE`, même signe négatif, même `WHERE status NOT ILIKE '%cancel%'`, même `AT TIME ZONE 'Europe/Paris'`. Objectif : éviter de recréer une variante du bug `service_fee ≡ commission_uber`.

2. **Edge function `weekly-uber-api`** : ajouter `commission_uber_ht` à la liste `RAW_KEYS` utilisée pour filtrer les `totals` en mode `list=1`. Les 4 granularités le propageront automatiquement via la RPC. **Attention** : c'est ce code path qui a déjà oublié un champ une fois — vérification explicite au test.

3. **Edge function `generate-weekly-uber-report`** (export XLSX interne) : ajouter la colonne "Commission Uber HT" dans les 4 feuilles + colonne CSV, format monétaire, pour rester cohérent avec l'API.

4. **Doc `docs/weekly-uber-api.md`** :
   - Tableau des champs → 7 lignes, ajouter `commission_uber_ht`.
   - Exemple JSON → ajouter la valeur cohérente (~-42 173 pour ~83 % du TTC).
   - Section principe → mentionner que la commission est disponible en HT **et** TTC, brutes Uber.
   - **Note comptable neutre** (correction réserve n°1) : *"L'API expose les deux valeurs brutes Uber (HT et TTC). Le traitement TVA relève de la comptabilité sur la base des factures Uber."* Aucune mention d'autoliquidation, aucune affirmation sur le régime TVA — le ratio observé (~1,20) contredirait une telle note.

5. **Régénération du PDF** via Playwright/Chromium → livraison dans `/mnt/documents/`. **Vérification manuelle avant livraison** : ouvrir le PDF, confirmer les 7 lignes du tableau, l'exemple JSON à jour, la note neutre.

## Ce qui ne bouge pas

- Aucun backfill de données (colonne déjà remplie).
- Aucun changement de schéma DB.
- Aucun changement de convention de signe sur les autres champs.
- Auth `x-api-key`, endpoints, paramètres, `list=1` en live : identiques.

## Protocole de test après déploiement

Trois `curl` obligatoires, résultats collés dans le chat avant de prévenir le comptable :

```bash
# 1. Semaine récente
curl -H "x-api-key: <clé>" \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?weekStart=2026-06-29&granularity=network"

# 2. Semaine ancienne (couverture historique)
curl -H "x-api-key: <clé>" \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?weekStart=2026-05-04&granularity=network"

# 3. list=1 (code path déjà pris en défaut une fois)
curl -H "x-api-key: <clé>" \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?list=1"
```

**Critères de validation** :
- `commission_uber_ht` présent dans les 3 réponses (dont chaque item de `list=1`).
- Signe négatif systématique.
- Ratio `commission_uber / commission_uber_ht ≈ 1,20` sur les deux semaines. Un ratio stable = construction saine ; un ratio qui dérape ou un signe qui diverge = bug de construction à corriger avant livraison.
- Contrôle croisé ligne-à-ligne sur `by_restaurant` d'une semaine (facultatif mais rapide) pour confirmer que le ratio est stable au grain restaurant, pas seulement en agrégé.

**Validation PDF** : ouvrir le fichier régénéré et vérifier visuellement le tableau à 7 lignes, l'exemple JSON, la note comptable neutre. Pas de livraison au comptable tant que les 3 curl + le PDF ne sont pas confirmés dans le chat.

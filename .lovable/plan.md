# Correctif parseurs versements Uber (format 2026)

## Ce que j'ai pu vérifier maintenant

Le dump des valeurs distinctes de « Description des autres paiements » sur le rapport Argenteuil 02-08 juin **n'est pas réalisable en mode plan** : la fonction de diagnostic actuelle ne renvoie que les en-têtes, et les liens de téléchargement Uber sont masqués côté outillage (impossible de télécharger le CSV hors edge function). Il faut donc étendre la fonction de diagnostic (1 déploiement) pour produire le tableau demandé.

Ce que la base montre déjà (historique importé, toutes marques, catégorie → description → nb lignes → montant) :

| Catégorie | Description (texte Uber) | Lignes | Montant | Dernière date |
|---|---|---|---|---|
| advertising | Dépenses publicitaires | 13 907 | -2 511 291,36 € | 2026-08-27 |
| advertising | Crédits publicitaires | 371 | +35 380,31 € | 2026-08-17 |
| eco_contribution | Autres frais | 6 154 | -162 540,60 € | 2026-08-27 |
| marketing_adjustment | Autres frais | 509 | +89 442,95 € | 2026-07-20 |
| tax_rounding | Autres frais | 311 | +7 361,32 € | 2026-08-27 |
| adjustment | Ajustement lié à l'arrondissement de la TVA | 8 167 | -329,55 € | 2026-08-27 |
| adjustment | Ajustement des frais de service | 55 | -52 069,99 € | 2026-06-08 |
| other_fee | Remboursements du restaurant / Frais de versement accéléré / Frais d'activation / Bonus parrainage / Frais sac | ~3 760 | — | 2026-08-26 |

Point d'attention : « Autres frais » est un libellé fourre-tout qui sert aujourd'hui à la fois pour l'éco-contribution, l'ajustement marketing et l'arrondi de TVA — c'est exactement le point fragile à sécuriser. Les valeurs réelles du rapport juin doivent confirmer si Uber a introduit de nouveaux libellés.

## Étape 1 — Compléter le diagnostic (1 déploiement, aucun ré-import)

Étendre `debug-report-headers` pour, sur le rapport Argenteuil 02-08 juin :
- parser toutes les lignes du CSV,
- grouper par valeur exacte de « Description des autres paiements »,
- renvoyer pour chaque valeur : texte brut, nombre de lignes, somme de « Autres paiements (TVA incluse) », et un exemple de ligne (colonnes marketing / frais / commande).

Je te montre le tableau résultat avant toute écriture dans les parseurs.

## Étape 2 — Correctif des 2 parseurs (préparé, non déployé)

Fichiers : `supabase/functions/parse-payment-report/index.ts` et `supabase/functions/parse-payout-summary/index.ts`.

1. **Routeur de catégorie centralisé** — remplacer la cascade de `includes()` actuelle par une table de règles ordonnées (libellé exact d'abord, puis motifs), appliquée au couple (description, montant, colonnes voisines) :
   - `advertising` : « Dépenses publicitaires », « Crédits publicitaires », + motifs `publicit`/`advertis`/`ads`
   - `eco_contribution` : libellés éco/contribution/environnement, et « Autres frais » **uniquement** si la colonne marketing est vide et |montant| ≥ 0,1381 €
   - `tax_rounding` : arrondi TVA, ou « Autres frais » sous le seuil
   - `marketing_adjustment` : « Autres frais » avec colonne marketing renseignée
   - `other_fee` / `adjustment` : reste, avec le libellé brut conservé
   - toute description non reconnue est loguée (et remontée dans le récap d'import) au lieu d'être silencieusement classée « other ».
2. **Alias de colonnes de frais** — ajouter au `COLUMN_MAPPING` les variantes 2026 vers `uber_fee` : « Frais de service de la Marketplace / frais de mise en relation (TVA incluse / hors TVA) », en **conservant** tous les anciens noms. Idem pour les alias déjà repérés : « Montant de la facturation rétroactive », « Ajustement marketing (TVA incluse) », et l'apostrophe typographique U+2019 dans « Identifiant de l'établissement externe » (normalisation des apostrophes dans `normalizeHeader`).
3. **Identifiant restaurant** — « Id. du restaurant » reste la clé primaire de résolution ; les UUID/identifiants externes restent en secours uniquement (comportement actuel inchangé).
4. **Aucun re-parse d'URLs stockées** — les `download_url` sont expirées ; le module de ré-import passera par une nouvelle demande de rapports à Uber.

## Étape 3 — Ré-import (uniquement après ton feu vert)

Re-demander à Uber les PAYMENT_DETAILS_REPORT juin → août 2026 par lots (par semaine / par groupe de restaurants), puis re-parser avec les parseurs corrigés, en vérifiant avant/après les totaux pub et éco-contribution par mois.

## Ce que je ne fais pas dans cette étape

Aucun déploiement des parseurs, aucun ré-import, aucune modification des données existantes tant que tu n'as pas validé le tableau de l'étape 1.

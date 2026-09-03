# Pourquoi la consolidation d'août reste bloquée (et comment la débloquer)

## Ce que montrent les données

La jauge « Consolidation des versements » mesure la part des commandes Uber qui ont
un `payout_date` rattaché. Août est à ~75 %, et le trou n'est pas aléatoire : il tombe
toujours sur les **lundis, mardis et mercredis**.

```text
Jour (Paris)   commandes   avec payout   %
02/08 (dim)      8 540       8 540      100
05/08 (mer)      8 355       1 441       17
10/08 (lun)      7 650       1 580       21
11/08 (mar)      7 141         319        4
12/08 (mer)      7 073         372        5
24/08 (lun)      8 652       1 498       17
25/08 (mar)      8 064         298        4
31/08 (lun)      9 536       1 671       18
```

Cause : les rapports « Payment Details » sont demandés en fenêtres glissantes de 3 jours
et terminés ~4 jours après la date de commande. Or Uber ne rattache le versement qu'au
**lundi suivant** (J+6/J+7 pour une commande du lundi). Les rapports d'une commande de
début de semaine sont donc lus **avant** que le versement existe, et rien ne repasse
ensuite : le `payout_date` reste vide pour toujours. Les commandes de jeudi→dimanche,
elles, sont capturées par des fenêtres plus tardives — d'où les 100 % sur ces jours.

Ce n'est donc pas une file bloquée : il n'y a aucun job en attente, tous les jobs
`PAYMENT_DETAILS_REPORT` d'août sont en `done`. C'est un problème de **timing**.

Deuxième point, plus mineur : 19 restaurants actifs n'ont pas `uber_pos_activated_at`
renseigné, et 10 boutiques ont encore des jobs en échec `user_not_allowed`. Uber vient
de confirmer l'activation de tous les stores — il faut donc les repasser en autorisé et
relancer leurs jobs.

## Ce qu'on va faire

### 1. Passe de rattrapage rétroactive (corrige août tout de suite)
Ré-enfiler des jobs `PAYMENT_DETAILS_REPORT` sur les jours où la couverture est
incomplète (fenêtres couvrant les 01/08 → 31/08 encore trouées), avec la priorité de
rattrapage. Comme les versements de ces semaines sont maintenant émis, la lecture
remontera cette fois le `payout_date` et la jauge d'août doit monter à ~99 %.

### 2. Correction de la cause racine (évite que ça se reproduise chaque semaine)
Ajouter une **passe hebdomadaire T+9** : chaque semaine, re-demander les rapports
Payment Details de la semaine de versement qui vient d'être payée (lundi J → on relit
la semaine J-14 → J-8). Elle tourne en plus du cycle quotidien existant, en priorité
basse pour ne pas concurrencer l'ingestion courante ni déclencher de throttle Uber.

### 3. Boutiques Uber nouvellement autorisées
- Relancer un test d'autorisation sur les 19 restaurants actifs sans
  `uber_pos_activated_at` et les 10 boutiques en `user_not_allowed`.
- Marquer comme activées celles qui répondent, puis ré-enfiler leur historique
  (juin → août) pour qu'elles entrent dans le périmètre de la jauge.
- Laisser en échec explicite celles qui refuseraient encore, avec la liste à renvoyer
  à Uber.

### 4. Lisibilité de la jauge
Le bandeau affichera aussi « rattrapage en cours » quand des jobs de la passe
rétroactive sont en file, pour que la progression soit compréhensible plutôt que figée.

## Détails techniques

- Aucune modification du parsing : `parse-payment-report` fonctionne, il est simplement
  appelé trop tôt.
- Ré-enfilage via insertion dans `backfill_jobs` (`report_type = 'PAYMENT_DETAILS_REPORT'`,
  vague dédiée pour le rattrapage), en respectant la contrainte unique
  `(restaurant_id, month_start, report_type)` — donc reset des lignes existantes plutôt
  qu'insertion en double.
- Passe hebdomadaire ajoutée en `pg_cron` (mardi, après émission du versement lundi).
- `get_payouts_consolidation_status` reste inchangée ; elle servira de contrôle avant/après.
- Rien ne touche aux autres types de rapports (les 4 045 échecs
  `ORDER_ERRORS_TRANSACTION_REPORT` sont un sujet distinct, hors périmètre ici).

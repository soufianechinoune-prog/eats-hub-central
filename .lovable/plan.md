# Consolidation : pourquoi seul août s'affiche, et pourquoi ça n'avance plus

## 1. Pourquoi seulement août ?

Non, août n'est pas le seul mois concerné. Le bandeau n'analyse que **les mois couverts par la période sélectionnée** — ici « Semaine précédente » (17–23 août), donc août uniquement.

Couverture réelle actuelle (réseau complet) :

| Mois | Commandes | Rattachées à un versement | Couverture |
|---|---|---|---|
| Mai 2026 | 293 302 | 281 009 | 95,8 % |
| Juin 2026 | 279 721 | 171 607 | 61,3 % |
| Juillet 2026 | 246 711 | 148 403 | 60,2 % |
| Août 2026 | 225 825 | 151 904 | 67,3 % |

Si tu sélectionnes « juin » ou une période juin→août, le bandeau listera bien les 3 mois. C'est volontaire (ne pas scanner toute l'année à chaque page), mais on peut l'élargir — voir option A.

## 2. Pourquoi ça n'avance plus

Deux causes distinctes, toutes deux vérifiées dans la file d'import :

**a) Il ne reste plus aucun job pour juin et juillet.** La file contient 694 jobs en attente, tous sur la **fin août** (semaine du 26/08). Zéro job en attente sur juin–juillet. Ces deux mois resteront donc figés à ~60 % tant qu'on ne les remet pas en file. C'est la cause principale de « ça n'avance pas ».

**b) 10 boutiques sont refusées par Uber.** Les échecs récents sont quasi tous `user_not_allowed` (« authorisation failed for … storeUUID ») : ce sont les stores pas encore provisionnés côté Uber — exactement ceux de la demande envoyée à Sanjay. Ils échouent en boucle et consomment du débit.

Le reste tourne normalement (≈ 140 jobs terminés sur la dernière heure), ce n'est donc pas un blocage global du worker.

## Ce que je propose de faire

1. **Remettre juin et juillet 2026 en file** (rapport de versements uniquement, `PAYMENT_DETAILS_REPORT`), par vagues, pour tous les restaurants actifs déjà provisionnés — c'est ce qui fera remonter la couverture de 60 % vers ~100 %.
2. **Mettre en quarantaine les 10 boutiques `user_not_allowed`** : arrêter de les replanifier automatiquement tant qu'Uber ne les a pas provisionnées, et les lister sur une carte dédiée dans Intégrations pour savoir quoi relancer une fois l'accès accordé.
3. **Élargir le bandeau (option A)** : afficher aussi les mois hors période affichée quand leur couverture est incomplète, sur les 3 derniers mois glissants — pour que juin/juillet soient visibles même en vue « semaine précédente ».
4. **Suivi** : afficher sur la page Intégrations le nombre de jobs en attente / échoués et la couverture par mois, pour voir la progression sans devoir demander.

## Détails techniques

- Ré-enfilement via insertion dans `backfill_jobs` (`report_type = 'PAYMENT_DETAILS_REPORT'`, `status = 'pending'`) pour les mois 2026-06 et 2026-07, restaurants ayant un `uber_store_id` provisionné (`uber_pos_activated_at` non nul), en évitant les doublons avec les jobs `done`.
- Quarantaine : marquage `status = 'blocked'` (ou `abandoned`) pour les jobs dont `last_error` contient `user_not_allowed`, et exclusion de ces stores lors du ré-enfilement.
- Bandeau : `usePayoutsConsolidation` appellera la RPC sur `min(début période, aujourd'hui − 3 mois)` → `fin période`, la RPC étant déjà rapide sur cette plage.

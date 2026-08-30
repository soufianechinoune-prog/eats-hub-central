# Consolidation : périmètre = boutiques autorisées par Uber, et déblocage de la file

## 1. Pourquoi seulement août ?

Non, août n'est pas le seul mois concerné. Le bandeau n'analyse que **les mois couverts par la période sélectionnée** — ici « Semaine précédente » (17–23 août), donc août uniquement.

Couverture réelle actuelle (réseau complet) :

| Mois | Commandes | Rattachées à un versement | Couverture |
|---|---|---|---|
| Mai 2026 | 293 302 | 281 009 | 95,8 % |
| Juin 2026 | 279 721 | 171 607 | 61,3 % |
| Juillet 2026 | 246 711 | 148 403 | 60,2 % |
| Août 2026 | 225 825 | 151 904 | 67,3 % |

## 2. Périmètre : uniquement les boutiques autorisées par Uber

D'accord, c'est le bon principe : un restaurant que Uber n'a pas encore provisionné ne pourra jamais atteindre 100 %, l'inclure fausse l'indicateur. Le compteur ne portera plus que sur les restaurants avec un accès API actif.

Mesure faite : sur août, en ne gardant que les boutiques autorisées, on passe de 67,3 % à **67,1 %** — l'écart est marginal, donc ce filtre assainit la lecture mais **n'explique pas** le retard. Sur juin et juillet, les chiffres sont identiques avec ou sans filtre.

## 3. La vraie cause du blocage

Deux constats vérifiés dans la file d'import :

**a) Il ne reste plus aucun job pour juin et juillet.** 694 jobs en attente, tous sur la **fin août** (semaine du 26/08). Zéro sur juin–juillet : ces deux mois resteront figés à ~60 % tant qu'on ne les remet pas en file. C'est la cause principale de « ça n'avance pas ».

**b) 10 boutiques sont refusées par Uber** (`user_not_allowed` : « authorisation failed for … storeUUID ») — celles en attente de provisioning côté Sanjay. Elles échouent en boucle et consomment du débit.

Le worker tourne normalement par ailleurs (≈ 140 jobs terminés sur la dernière heure).

## Ce que je propose de faire

1. **Restreindre l'indicateur aux boutiques autorisées** : ne compter que les restaurants dont l'accès API Uber est actif, et afficher une mention « X boutiques en attente d'autorisation Uber, exclues du calcul » pour rester transparent.
2. **Remettre juin et juillet 2026 en file** (rapport de versements uniquement), par vagues, pour les restaurants autorisés — c'est ce qui fera remonter la couverture de 60 % vers ~100 %.
3. **Mettre en quarantaine les 10 boutiques `user_not_allowed`** : arrêter de les replanifier automatiquement, et les lister sur une carte dédiée dans Intégrations pour les relancer dès qu'Uber les aura ouvertes.
4. **Élargir le bandeau** aux 3 derniers mois glissants, même hors période affichée, pour que juin/juillet restent visibles en vue « semaine précédente ».

## Détails techniques

- `get_payouts_consolidation_status` : ajout d'un filtre `EXISTS (select 1 from restaurants r where r.id = o.restaurant_id and r.uber_pos_activated_at is not null)`, plus deux colonnes retournées (`stores_pending_auth`) pour la mention d'exclusion.
- Ré-enfilement via insertion dans `backfill_jobs` (`report_type = 'PAYMENT_DETAILS_REPORT'`, `status = 'pending'`) pour 2026-06 et 2026-07, restaurants avec `uber_pos_activated_at` non nul, en évitant les doublons avec les jobs `done`.
- Quarantaine : passage des jobs dont `last_error` contient `user_not_allowed` en `abandoned`, et exclusion de ces stores lors du ré-enfilement.
- `usePayoutsConsolidation` : plage interrogée = `min(début période, aujourd'hui − 3 mois)` → `fin période`.

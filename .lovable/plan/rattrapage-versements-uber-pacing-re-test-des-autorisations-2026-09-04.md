# Rattrapage versements Uber : pacing + re-test des autorisations boutiques

## Ce que montre l'état actuel

File de rattrapage (`vague 900`, PAYMENT_DETAILS_REPORT) : **665 en attente, 5 en cours, 183 terminés, 7 en échec**. Les 7 échecs ne sont pas des throttles mais des refus d'autorisation Uber (`user_not_allowed`). Un seul job a subi un requeue 429 jusqu'ici.

Deux problèmes confirmés :

1. **Le rattrapage n'est PAS en priorité basse.** L'ordre de service trie par `vague` croissant : 900 (rattrapage) passe donc **avant** 999 (import quotidien). Le débit est aussi trop élevé : 5 jobs par tick, 1 tick par minute (~300 rapports/heure), ce qui est exactement ce qui a déclenché les 429 Uber déjà vécus.

2. **`uber_pos_activated_at` n'est pas un marqueur fiable.** Tous les restaurants avec un `uber_store_id` ont déjà cette date (posée en masse le 04/05/2026) — y compris les 7 qui se font refuser aujourd'hui. Il n'existe donc aucune liste fiable des boutiques réellement autorisées : seul un test réel côté Uber peut trancher.

Refus constatés à ce jour (7) : Chicken Street Armentières (inactif), Avignon (inactif), Metz Muse (inactif), Toulon (inactif), Strasbourg (actif), Tasty Crousty Creil (actif), Tasty Crousty Marseille Garibaldi (actif).

## Point 1 — Pacing du rattrapage

- Basculer les jobs de rattrapage sur une **vague 1200** (au-dessus de 999) pour qu'ils passent systématiquement après l'import quotidien, et aligner la fonction de rattrapage sur cette valeur.
- **Débit adaptatif dans le worker** : 2 jobs par tick lorsque le lot sélectionné ne contient que du rattrapage (vague ≥ 1000), 5 sinon. Délai inter-job porté à ~3 s sur les ticks de rattrapage.
- **Frein automatique sur 429** : si un requeue 429 a eu lieu dans les 10 dernières minutes, le tick suivant ne prend qu'1 job. Évite l'effet boule de neige.
- Le mécanisme existant reste inchangé (retry avec `Retry-After`, requeue via `next_attempt_at`, bascule en `failed` après 10 requeues).
- À ce rythme (~2/min), les 665 jobs restants se dépilent en ~6 h, sans concurrencer l'import du jour.

## Point 2 — Re-test de toutes les autorisations boutiques

- Ajouter une fonction `uber-authorize-audit` qui, pour **tous** les restaurants disposant d'un `uber_store_id`, appelle le test de validation boutique Uber, séquentiellement et espacé (~1,5 s), par lots bornés pour rester dans le temps d'exécution.
- Résultat écrit en base par boutique : autorisée (date de vérification mise à jour) ou refusée (`uber_pos_activated_at` remis à null + motif enregistré), pour qu'on cesse de croire des boutiques autorisées à tort.
- Pour chaque boutique qui répond OK et dont l'historique est incomplet, **ré-enfiler juin → août 2026** en PAYMENT_DETAILS_REPORT, par fenêtres hebdomadaires, en vague de rattrapage (idempotent : upsert sur restaurant + fenêtre + type).
- Réinitialiser les 7 jobs actuellement `failed` pour cause d'autorisation, uniquement pour les boutiques qui repassent OK.
- **Livrable** : la liste nominative des boutiques encore refusées après le re-test (nom, UUID Uber, enseigne, actif/inactif), prête à renvoyer à Uber.

## Suivi

- Écran d'admin/bandeau existant : afficher en plus le compteur d'échecs throttle et le nombre de jobs en requeue 429, pour surveiller le dépilage.
- Après le passage : re-mesure de la couverture août et comparaison avant/après.

## Détails techniques

- `supabase/functions/uber-backfill-worker/index.ts` : `PARALLEL` et `INTER_JOB_DELAY_MS` deviennent dynamiques selon la vague du lot ; ajout d'une lecture du dernier requeue 429 pour le frein.
- `supabase/functions/uber-payout-retro-backfill/index.ts` : `RETRO_VAGUE` 900 → 1200.
- Migration : `UPDATE backfill_jobs SET vague = 1200 WHERE vague = 900 AND status = 'pending'`.
- Nouvelle fonction `uber-authorize-audit` (batch borné + reprise), colonnes de traçabilité sur `restaurants` (`uber_auth_checked_at`, `uber_auth_error`).
- Aucune modification des règles de calcul des versements.

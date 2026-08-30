# Faire apparaître l'indicateur « consolidation en cours »

## Ce qui se passe

Le bandeau est bien branché sur la Vue d'ensemble (canaux Global / Uber Eats) et sur Finances, mais il ne s'affiche jamais : la fonction serveur qui calcule la couverture des versements **dépasse le délai d'exécution**. Vérifié à l'instant — l'appel sur l'année 2026 pour Chicken Street ne répond pas.

Cause : la fonction balaye **toute l'année de commandes deux fois** (des millions de lignes), au lieu de se limiter à la période affichée. Quand elle échoue, le composant ne rend rien du tout, donc aucun indicateur visible.

Contrôle fait sur le même calcul restreint au mois d'août : réponse immédiate, **151 904 / 225 825 commandes rattachées (67 %)** → le bandeau a bien lieu d'être affiché.

## Correctifs

1. **Recalibrer la fonction de couverture** : ne plus raisonner par année mais sur la plage de dates réellement sélectionnée, en une seule passe (comptage par mois puis filtre sur couverture < 100 %), avec des bornes de dates qui utilisent l'index existant sur `orders`.
2. **Adapter le hook** pour passer directement la période (début/fin) au lieu de faire un appel par année.
3. **Rendre l'échec visible** : si l'appel échoue, journaliser l'erreur en console plutôt que de disparaître silencieusement.
4. **Remonter le bandeau** en haut de la Vue d'ensemble (juste sous l'en-tête de période) plutôt qu'en bas de page, pour qu'il soit vu sans scroller ; idem en haut de la vue Finances.

## Vérification

- Appel direct de la fonction sur la période affichée : réponse < 2 s.
- Contrôle visuel de la Vue d'ensemble (Global et Uber Eats) : bandeau ambre visible avec août ≈ 67 %.
- Contrôle sur une période 100 % consolidée (avril 2026) : aucun bandeau.

## Détails techniques

- Remplacement de `get_payouts_consolidation_status(p_year, p_restaurant_ids)` par une version `(p_start date, p_end date, p_restaurant_ids uuid[])`, `SECURITY DEFINER`, `search_path = public`, grant `authenticated`.
- Suppression du CTE `incomplete_months` (double scan) au profit d'un `GROUP BY date_trunc('month', order_datetime AT TIME ZONE 'Europe/Paris')` + `HAVING count(payout_date) < count(*)`.
- Prédicat de dates sur `order_datetime` en `timestamptz` borné (pas de `EXTRACT`), pour rester index-friendly.
- `src/hooks/usePayoutsConsolidation.ts` : un seul appel RPC, plus de boucle sur les années.

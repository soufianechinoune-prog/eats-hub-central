
Objectif: corriger pourquoi l’onglet **/analytics/offers** affiche 0 partout alors que les données de Juin 2025 existent.

Constat (vérifié en base)
- Les données sont bien présentes:
  - Juin 2025: **118 729 commandes**, **28 095 commandes taxées**, **30 061,65€** de frais.
- La fonction RPC `get_offers_analytics` échoue actuellement avec:
  - `operator does not exist: text + interval`
- Cause précise: dans la fonction SQL, on fait `p_end_date + interval '1 day'` alors que `p_end_date` est de type `text`.
- Côté UI, l’erreur RPC n’est pas affichée: le hook retourne des tableaux vides => KPIs à 0 (effet “silencieux”).

Plan de correction
1) Corriger la RPC `get_offers_analytics` (migration SQL)
- Corriger la borne de fin en castant explicitement:
  - `o.order_datetime < ((p_end_date::date + 1)::timestamp)`
- Option robuste recommandée: typer les paramètres en `date` (au lieu de `text`) pour éviter ce type d’erreur à l’avenir.
- Conserver la logique frais déjà correcte:
  - `taxed_orders` basé sur `offer_usage_fee`
  - `total_offer_fees` = `ABS(offer_usage_fee) + ABS(vat_offer_usage_fee)`

2) Ajouter une vraie gestion d’erreur côté frontend
- `useOffersAnalytics` doit exposer `isError` + `errorMessage`.
- `OffersAnalyticsSection` doit afficher un état d’erreur clair (au lieu d’afficher 0) si la RPC échoue.
- Garder l’état “loading” actuel.

3) Validation fonctionnelle après fix
- Vérifier que `get_offers_analytics(null, '2025-06-01', '2025-06-30')` renvoie des lignes.
- Vérifier l’UI sur `/analytics/offers` avec filtre **Juin 2025**:
  - KPI “Total frais d’offre” > 0
  - Tableau restaurant rempli
  - `% taxé/promo` et `frais/cmd` cohérents

Résultat attendu
- Tu vois immédiatement les chiffres de Juin 2025 (et du reste de l’historique déjà backfillé).
- Aucun réimport CSV nécessaire.
- En cas de futur souci RPC, l’interface affiche une erreur explicite au lieu de faux zéros.

Détails techniques
- Fichier SQL concerné: migration qui redéfinit `get_offers_analytics`.
- Fichiers frontend concernés:
  - `src/hooks/useOffersAnalytics.ts`
  - `src/components/analytics/OffersAnalyticsSection.tsx`
- Pas de changement RLS requis pour ce correctif (problème purement logique/type SQL + UX d’erreur).

# Panneau « Effet réel des ads » (tête de réseau)

D'accord avec la méthode de Claude, avec deux ajustements (voir fin).

## Ce que vous verrez sur la page Dépenses pub / CA
Le bloc actuel « Rendement de la pub » est remplacé par un panneau **« Effet réel des ads »**, même style Mijotek (cartes sobres, chiffres lisibles, infobulles « i »), placé au-dessus du classement.

1. **Bandeau périmètre** : « Périmètre constant » actif par défaut (ouvertures récentes exclues), avec le nombre de restaurants retenus / exclus.
2. **4 indicateurs**, tous calculés sur le versement réel, sans taux inventé :
   - Taux de reversement (versement ÷ CA) + médiane réseau, restos anormalement bas signalés.
   - Intensité pub (pub ÷ CA) vs médiane réseau.
   - Versement gagné par € de pub supplémentaire (vert si > 1 €, sinon gris neutre).
   - Effet net sur le CA vs groupe témoin (en points).
3. **Graphique groupe témoin à la semaine** : deux courbes (restos qui ont augmenté leurs ads vs « jumeaux » stables), CA indexé à 100 avant la période, l'écart = effet net. Zone grisée sur les 14 derniers jours (consolidation).
4. **Encart Uber One** : taux de reversement par tranche de part Uber One, et évolution de la part Uber One chez les restos qui augmentent leurs ads vs témoin.
5. Mention permanente : « constat statistique, effet variable selon les restaurants ».

## Détails techniques
- Une RPC `get_ads_effect_weekly(p_restaurant_ids, p_start, p_end)` : par restaurant et par semaine (lundi, Paris) → CA net TTC (`rev_net_ttc`), versement (`net_payout + meal_voucher`) depuis `orders_daily_summary`, pub `abs(amount)` de `payout_adjustments` category='advertising' via `ads_reporting_date`. Isolation via `user_has_chain_access`.
- Uber One : non présent dans la table résumé → RPC séparée `get_ads_uber_one_share` qui agrège `orders` par restaurant/mois (`uber_one_status ILIKE 'Membre%'`), chargée à part pour ne pas ralentir le reste.
- Périmètre constant : `getEffectiveOpeningDate` appliqué côté front avant l'appel (restos ouverts avant le début de la période de référence et avec CA sur les deux périodes).
- Calculs (cohortes, appariement des jumeaux, différence de différences) en fonctions pures dans `src/lib/adsEffect.ts` + tests (appariement, effet net, reversement incrémental).
- Appariement : groupe « hausse » = ratio pub période B ≥ ratio A + 0,5 pt ; témoin = variation de ratio < 0,5 pt ; jumeau = témoin le plus proche en tendance de CA des 8 semaines avant.

## Ajustements par rapport au brief
- Le versement par jour existe déjà dans la table résumé : rien à reconstruire.
- Uber One reste lu sur les commandes brutes (agrégé côté serveur, par mois), car la table résumé ne le contient pas ; si c'est trop lent, j'ajouterai la colonne dans la table résumé en second temps.
- La fiche restaurant n'est pas modifiée dans cette étape.

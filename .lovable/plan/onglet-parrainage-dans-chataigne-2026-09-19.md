# Onglet « Parrainage » dans Chataigne

Nouvel onglet **Parrainage**, dans la page Chataigne, avec le même style et les mêmes filtres que « Croissance & Clients » (sélecteur réseau/restaurant + période). 100 % anonyme : aucun client n'est identifié, tout passe par le code client anonymisé.

## Définitions figées

- **Filleul** : client dont la 1ʳᵉ commande porte la remise « Code Parrainage » (−25 %). Il est ensuite suivi sur toutes ses commandes via son code client.
- **Parrain** : client dont une commande porte « Referral Reward » (−15 %).
- **Contribution** : montant encaissé − 1 € (Chataigne) − frais Stripe (0,25 € + 1,5 %). Pas de coût matière pour l'instant : un emplacement est prévu pour la marge réelle plus tard.
- **CAC filleul** : remise filleul (−25 %) + part de remise parrain (−15 %) attribuée.

### Deux points de vérité relevés dans les données (à valider)

1. Le montant de commande enregistré est **déjà net des remises** (montant encaissé = montant commande). Retirer à nouveau les remises reviendrait à les compter deux fois : la contribution part donc du montant encaissé.
2. Les données ne relient **pas** un « Referral Reward » à son filleul déclencheur (la remise parrain est portée par la commande du parrain, sans référence au filleul). L'attribution se fera donc **en moyenne** : total des remises parrain de la période ÷ nombre de filleuls de la période. C'est indiqué à l'écran sous le CAC pour éviter toute lecture erronée.

## Contenu de l'onglet

### 1. Acquisition dans le temps (priorité 1)
Nombre de filleuls et de parrains par semaine, filleuls par parrain (viralité), part du parrainage dans les nouveaux clients. KPI : filleuls, parrains, viralité, CAC moyen.

### 2. Avant / après un changement de barème (priorité 1)
Les graphiques acceptent des **marqueurs verticaux que vous ajoutez vous-même** (date + libellé), via le mécanisme d'annotation déjà utilisé sur « Croissance & Clients » : clic sur le graphique → saisie du libellé, clic sur un marqueur → modification. Aucune date codée en dur.
Bloc avant/après : choix d'un marqueur dans une liste, puis comparaison des métriques clés (filleuls/semaine, CAC, taux de réachat, panier moyen) sur la même durée avant et après, avec l'écart.

### 3. Payback du filleul (priorité 2)
Contribution cumulée moyenne par rang de commande (1ʳᵉ, 2ᵉ, 3ᵉ…) et par jours depuis l'acquisition, avec une ligne horizontale au niveau du CAC : le croisement est le point de rentabilisation. KPI « rentabilisé au bout de X commandes / Y jours ». Mention explicite du caractère indicatif tant que les cohortes sont jeunes.

### 4. Réachat des filleuls (priorité 3)
Taux de réachat, rétention par cohorte mensuelle (M+1, M+2…), comparaison filleul vs promo de bienvenue vs organique, récurrence et panier moyen.

**Volontairement exclus pour l'instant** : valeur vie client et ratio valeur/coût d'acquisition (filleuls trop récents, pas de coût matière). On garde le coût d'acquisition et le payback.

## Détails techniques

- 3 RPC nouvelles : `get_chataigne_referral_acquisition(p_start, p_end, p_granularity, p_restaurant_ids)`, `get_chataigne_referral_payback(p_start, p_end, p_restaurant_ids)`, `get_chataigne_referral_retention(p_start, p_end, p_restaurant_ids)`. Toutes : `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, `statement_timeout`, garde `is_super_admin() OR user_has_chain_access(chain_id)`, `GRANT authenticated + service_role`, `REVOKE anon`.
- Anti-fan-out strict : agrégation par `code_client` (CTE `cohorte` : 1ʳᵉ commande, flags de remise, rangs) **avant** toute composition ; jamais de jointure ligne-à-ligne d'items avant agrégation. Les remises sont extraites via un `EXISTS`/sous-agrégat sur `discounts`, pas par `lateral` multipliant les commandes.
- Attribution filleul : 1ʳᵉ commande du code client portant « Code Parrainage » ; libellés reconnus `Code Parrainage`, `Article Offert - Parrainage` (filleul) et `Referral Reward` (parrain).
- Réutilisation de `get_chataigne_referral_evolution` / `get_chataigne_referral_summary` pour les KPI déjà couverts ; nouvelles RPC seulement pour ce qui manque (viralité, part des nouveaux, payback, cohortes filleuls).
- Front : nouveau composant `ChataigneReferral.tsx` branché en onglet `?tab=referral` de `Chataigne.tsx` (+ entrée dans la barre latérale des canaux), hook `useChataigneReferral.ts`, filtres `AnalyticsContext`, composants graphiques existants (Recharts + `KPICard` + `Card`), marqueurs via `renderChartNoteMarkers` / `ChartNoteDialog`, dark mode par tokens.
- Aucune donnée existante modifiée, aucun calcul d'un autre écran touché.

## Ordre de livraison

1. RPC acquisition + écran Acquisition & Avant/après (marqueurs ajoutables)
2. Payback
3. Réachat

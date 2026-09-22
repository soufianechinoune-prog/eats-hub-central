# Coût d'acquisition : paramétrer chaque type d'offre (remise / produit offert)

Aujourd'hui la vision restaurateur applique un seul taux de food cost à tout. Or les deux barèmes de parrainage ne se valorisent pas pareil, et les données montrent qu'ils se succèdent dans le temps :

- **Remise « Code Parrainage » (−25 %)** : 637 commandes, du 23/08 au 18/09, 7,24 € en moyenne.
- **Produit offert « Article Offert - Parrainage »** : 21 commandes, depuis le 19/09, 8,17 € de valeur de vente en moyenne.
- **Remise parrain « Referral Reward » (−15 %)** : 197 commandes, 3,20 € en moyenne.

## Ce qui change

Le panneau « Coût d'acquisition par filleul » garde son basculeur **Client / Restaurateur**, mais chaque vision reçoit ses propres réglages, séparés par type d'offre.

**Vision client (perception)** — inchangée dans l'esprit
- Remise en € : le montant non encaissé, tel quel.
- Produit offert : sa valeur de vente (ce que le client perçoit comme cadeau).
- Remise parrain : montant tel quel.

**Vision restaurateur (coût matière)** — trois réglages distincts
- **Food cost remises** (défaut 40 %) : appliqué aux remises en € filleul et parrain.
- **Food cost produit offert / bogo** (défaut 40 %) : appliqué à la valeur de vente du produit offert.
- **Montant € par produit offert** (optionnel) : s'il est saisi, il remplace le calcul en pourcentage pour le produit offert (utile quand on connaît le coût matière réel du produit du bogo).

Chaque réglage est mémorisé localement, réinitialisable, et n'agit que sur le panneau CAC.

## Lire quel barème était actif

Sous le titre du panneau, une mention indique la composition de la période affichée, par exemple : « 637 acquisitions par remise · 21 par produit offert ». Et l'infobulle de chaque point détaille :

- nombre de filleuls,
- coût issu des remises,
- coût issu des produits offerts (avec le nombre),
- coût parrain,
- CAC résultant.

On voit ainsi immédiatement à quel moment on est passé du −25 % au bogo, et l'effet sur le coût réel.

## Portée

Seul le panneau « Coût d'acquisition par filleul » (courbe, moyenne glissante, infobulle, mentions) est concerné. La vignette d'indicateur, l'avant/après et la rentabilisation restent en vision client comme aujourd'hui. La garde de fiabilité (moins de 5 filleuls = période non tracée) est conservée.

## Détails techniques

- Aucune RPC ni migration : `get_chataigne_referral_acquisition` renvoie déjà `cout_filleul`, `offert_count`, `offert_vente`, `cout_parrain`. La part « remise pure » se déduit par `cout_filleul − offert_vente`.
- Dans `src/pages/ChataigneReferral.tsx` : remplacer `foodCostPct` unique par `foodCostRemisePct`, `foodCostOffertPct` et l'override `offertCostEur` (clés `localStorage` dédiées).
- Fonction de coût unique consommée par `cacSeries` et sa moyenne glissante :
  - client : `(cout_filleul − offert_vente) + offert_count × offertCostEur? : offert_vente` + `cout_parrain`
  - restaurateur : `(cout_filleul − offert_vente) × remisePct + (offertCostEur ? offert_count × offertCostEur : offert_vente × offertPct) + cout_parrain × remisePct`
- Aucun autre calcul de la page, aucune donnée existante touchés.

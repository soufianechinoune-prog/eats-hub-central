# Coût d'acquisition : deux visions (client / restaurateur)

Sur la courbe « Coût d'acquisition par filleul », ajouter un basculeur entre deux façons de valoriser le coût, car une remise de −25 % ne coûte pas 25 % au restaurateur.

## Les deux visions

**Vision client (perception)** — comportement actuel, conservé par défaut
- Remise en € = le montant non encaissé, tel quel.
- Produit offert = valorisé à son prix de vente (ou au coût saisi, réglage existant conservé).

**Vision restaurateur (coût réel)**
- Remise en € × taux de food cost paramétrable = coût réel.
  Exemple : 3,50 € de remise avec un food cost à 40 % → 1,40 €.
- Produit offert : même logique, sa valeur de vente × le même taux.
- Taux de food cost par défaut : **40 %**, modifiable dans un champ à côté du basculeur (mémorisé localement, comme le réglage « coût produit offert »).

## Portée

Le basculeur n'agit que sur le panneau « Coût d'acquisition par filleul » : la courbe, sa moyenne glissante, l'infobulle et la mention sous le titre. Le reste de la page (vignette d'indicateur, avant/après, rentabilisation) reste en vision client, inchangé.

## Lecture à l'écran

- Deux boutons : **Client** / **Restaurateur**, même style que le basculeur Courbes/Barres.
- En vision restaurateur, un libellé précise : « remises et produits offerts valorisés à X % de food cost — coût réel pour le restaurateur ».
- Le réglage « coût produit offert » reste visible et utilisé en vision client ; en vision restaurateur, il est remplacé par le champ de food cost.
- La garde de fiabilité (moins de 5 filleuls = période non tracée) est conservée dans les deux visions.

## Détails techniques

- Tout se fait dans `src/pages/ChataigneReferral.tsx` : nouvel état `costView` ("client" | "owner") + `foodCostPct` (défaut 40, persistés en `localStorage` sous de nouvelles clés).
- `effectiveCoutFilleul` reçoit la vision : en mode owner, `(cout_filleul) × pct` et `cout_parrain × pct` ; en mode client, la formule actuelle (`cout_filleul − offert_vente + offert_count × offertCost`).
- Le calcul dérivé de la courbe (`cacSeries`) et sa moyenne glissante consomment la même fonction ; aucune RPC ni migration, aucun autre calcul de la page touché.

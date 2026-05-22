Constat après vérification du code et des chiffres March 2026 :

1. Le haut est cohérent avec la base complète
   - Pour TASTY CROUSTY / Mars 2026, le haut affiche 1394 lignes jour×resto, 186315 commandes, CA 3470720 €, commission 650084 €, promos 222131 €, remb. 17176 €, versement total 2470821 €.
   - Ces chiffres correspondent au détail complet `get_orders_finance_detail`.

2. Le bas n’est pas sur la même extraction complète
   - `Analyse par Commandes` appelle `get_finances_daily_uber` sans pagination.
   - Cette RPC retourne une ligne par restaurant × jour. En mars, il y en a 1394, donc au-dessus de la limite REST de 1000 lignes.
   - Résultat : le bas est tronqué à 1000 lignes, d’où les totaux faux : commandes, commissions, promos, remboursements, versements.
   - Le problème “1000” a été corrigé pour le comparatif haut, mais pas pour cette nouvelle RPC du bas.

3. Les dates visibles en bas sont trompeuses
   - Dans la capture, le tableau du bas est simplement scrollé plus bas : on voit 24–31 mars, mais le total est censé représenter toutes les lignes chargées.
   - Le vrai problème n’est pas seulement la date visible : c’est que toutes les lignes de mars ne sont pas chargées.

4. Il y a aussi une incohérence de formule
   - Le haut affiche la commission HT, conformément à la logique comptable.
   - Le bas utilise une agrégation différente, et certains montants sont calculés avec `ABS()` au niveau commande, alors que le haut agrège d’abord par jour×resto puis affiche l’absolu.
   - Même sans la limite 1000, certains montants comme Remboursements pourraient encore différer.

Plan de correction :

1. Réutiliser la même source pour le haut et le bas
   - Passer les lignes complètes `get_orders_finance_detail` déjà récupérées par le comparatif vers `OrdersAnalysisSection`.
   - Construire l’onglet `Par Jour` du bas à partir de ces mêmes lignes, au lieu de rappeler `get_finances_daily_uber`.
   - Ainsi, les totaux du bas correspondront exactement aux totaux du haut.

2. Supprimer l’effet limite 1000 sur l’analyse du bas
   - Ne plus dépendre de `get_finances_daily_uber` pour le total journalier lorsque le détail mensuel est déjà disponible.
   - Garder les RPC spécialisées uniquement pour les vues qui en ont besoin : `Par Produit`, `Par Heure`, `Par Commande`.
   - Si une vue garde une RPC qui retourne plus de 1000 lignes, ajouter une pagination `.range()` comme pour le comparatif.

3. Aligner les formules affichées
   - CA : `sales_incl_vat`.
   - Commission : utiliser la même base HT que le comparatif.
   - Promos : même agrégation que le comparatif.
   - Remboursements : même agrégation que le comparatif, pas un `ABS()` commande par commande.
   - Versement Uber et Versement Total : même logique `net_payout` + `meal_voucher_amount` que le haut.

4. Aligner explicitement la période
   - Centraliser la période Finances sélectionnée : Mars 2026 = 1 mars → 31 mars.
   - La passer telle quelle au comparatif et à `OrdersAnalysisSection`, sans recalcul local basé sur 7 jours / 30 jours / état global résiduel.

5. Validation finale
   - Vérifier March 2026 / Tous les restaurants TASTY CROUSTY :
     - 1394 lignes jour×resto
     - 186315 commandes
     - CA 3470720 €
     - Commission 650084 €
     - Promos 222131 €
     - Remb. 17176 €
     - Versement Uber 2346325 €
     - Titre resto 124496 €
     - Versement total 2470821 €
   - Confirmer que le total `Par Jour` en bas matche le comparatif haut.
# Audit Chataigne dans la répartition réseau et les mixes canaux

## Ce que j'ai vérifié (état actuel)

Données : Chataigne est bien alimenté et rattaché — juin 3 201 €, juillet 80 579 €, août 132 064 € (105 restaurants), 0 commande orpheline (sans restaurant).

Chataigne est **déjà inclus** dans :
- La barre « Répartition du CA réseau » (`PlatformRevenueSplit`) : 4e segment + légende, et surtout au dénominateur du calcul des % (Uber/Deliveroo/Caisse recalculés).
- Le mix par restaurant du tableau comparatif : puce canal + mini-barre « CA mix ».
- Le panneau déplié par restaurant (`ChannelBreakdownPanel`) : ligne Chataigne (CA, commandes, panier moyen, part).
- Le graphique quotidien par canal (`ChannelDailyRevenueChart`), aire empilée € et %.
- La période : le hook `useChataigneByRestaurant` reçoit bien `startDate`/`endDate` de la période sélectionnée et le périmètre `activeIds`.

## Écarts trouvés (à corriger)

1. **Colonne « CA » du tableau comparatif (onglet Tous)** : elle affiche `revenue` = Uber + Deliveroo uniquement. La mini-barre en dessous montre pourtant Caisse + Chataigne → le chiffre et la barre ne racontent pas la même chose.
2. **Ligne RÉSEAU du tableau (onglet Tous)** : total CA, commandes et panier moyen viennent de `networkTotals`, qui n'intègre ni Caisse ni Chataigne. Donc le total réseau du tableau est incohérent avec la barre « Répartition du CA réseau ».
3. **Pas d'onglet Chataigne** dans le sélecteur de canaux du tableau (Tous / Uber / Deliveroo / Caisse), alors que le canal existe désormais.

## Correctifs proposés

- Ajouter au tableau comparatif un total « tous canaux » cohérent : dans l'onglet Tous, le CA par restaurant et la ligne RÉSEAU incluent Uber + Deliveroo + Caisse + Chataigne, avec une infobulle précisant la composition. Les colonnes propres à la livraison (versement, rentabilité, note, erreurs) restent inchangées.
- Ajouter un onglet **Chataigne** (visible seulement si CA Chataigne > 0 sur la période) avec CA, commandes, panier moyen par restaurant, et total réseau.
- Vérification finale en preview sur la période sélectionnée : total tableau = total barre de répartition réseau.

## Détails techniques

- `src/components/overview/RestaurantComparisonTable.tsx` : `projectForTab("all")` → `revenue = r.revenue + cash + chataigne`, `orders` idem, `avgBasket` recalculé ; ligne totaux → sommer les lignes projetées au lieu de `networkTotals.totalRevenue` pour l'onglet Tous (garder `networkTotals` pour versement / TR / variation N-1 Uber). Ajouter `"chataigne"` au type `ChannelTab` et au `forcedChannel`, plus un bloc `cols` dédié.
- `src/pages/Overview.tsx` : aucun changement de données nécessaire, `chataigneByRestaurant` est déjà passé au tableau.
- Aucune modification SQL / RPC.

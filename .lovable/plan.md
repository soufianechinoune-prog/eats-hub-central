# CA Dishop : pourquoi le chiffre paraît faux

## Ce que montrent les données

La tuile « Dishop » affiche 62 831 € pour juillet 2026. En base, deux problèmes expliquent ce chiffre :

**1. Les données Dishop s'arrêtent au 15 juillet 2026**

Dernière semaine importée : 13 → 15 juillet (3 jours seulement). Historique par semaine :

```text
sem. 01-07 juin : 37 977 €    sem. 29 juin-05 juil : 32 799 €
sem. 08-14 juin : 37 847 €    sem. 06-12 juil     : 34 013 €
sem. 15-21 juin : 29 854 €    sem. 13-15 juil     :  7 477 €  <- s'arrête ici
sem. 22-28 juin : 33 003 €
```

Juin complet = 145 927 € ; juillet ne couvre que la moitié du mois. La tuile compare donc un mois complet (Splash, Uber, Deliveroo) à une demi-période Dishop, ce qui fait paraître le canal minuscule (0,6 % du CA).

**2. Environ 600 commandes ne sont rattachées à aucun restaurant**

8 653 € de CA Dishop sont invisibles dans l'app car `restaurant_id` est vide. Boutiques concernées : `chickenstreet` (2 655 €), `cs-belfort`, `cs-bordeaux-merignac`, `cs-lyon6`, `cs-dijon`, `cs-champs-sur-marne`, `cs-lyon1`, `cs-marseille-15`, `cs-marseille-belsunce`, `cs-dijon-gare`, `cs-bordeaux`, `cs-drancy`, `cs-reunion-sd`, `cs-lens`, `cs-oberkampf`. Plusieurs de ces boutiques ont pourtant des commandes correctement rattachées à d'autres dates : le mapping a été créé après coup et les anciennes lignes n'ont pas été reprises.

Le calcul lui-même est correct : somme de `price_total` (TTC) des commandes Dishop, filtrées par marque, restaurants sélectionnés et période.

## Correctifs proposés

1. **Relancer la synchronisation Dishop** depuis le 13 juillet jusqu'à aujourd'hui (semaine par semaine, via la fonction d'import hebdomadaire existante) et vérifier pourquoi elle s'est arrêtée (log de la dernière exécution).
2. **Rattacher rétroactivement les commandes orphelines** : pour chaque boutique Dishop déjà mappée, réappliquer le mapping aux anciennes lignes ; lister ensuite les boutiques réellement sans mapping pour les créer (notamment `chickenstreet`, qui est un identifiant générique à qualifier).
3. **Signaler la couverture partielle dans l'UI** : afficher sur la tuile Dishop la date de dernière donnée disponible (ex. « données jusqu'au 15/07 ») quand elle est antérieure à la fin de la période sélectionnée, pour éviter de lire un chiffre incomplet comme une baisse d'activité.

## Détails techniques

- Point 1 : appel de la fonction `dishop-sync-week` pour les semaines manquantes + lecture de `dishop_sync_runs` pour la cause de l'arrêt.
- Point 2 : mise à jour ciblée de `dishop_orders.restaurant_id`/`chain_id` par jointure sur `dishop_shop_mapping`, puis inventaire des `dishop_shop_id` restants sans mapping.
- Point 3 : requête max(order_date) par marque, affichée en légende de la tuile dans `ChannelRevenueTiles.tsx` (aucun changement de calcul).

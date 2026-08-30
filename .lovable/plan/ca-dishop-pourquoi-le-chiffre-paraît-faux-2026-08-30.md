# CA Dishop : pourquoi le chiffre paraît faux

## Réponse à la question

Oui, l'intégration API Dishop existe : une tâche automatique tourne chaque lundi à 05h00, appelle l'API Dishop (export hebdomadaire « accounting-report »), télécharge un ZIP (commandes, facturations, clients) et l'insère en base.

## Cause identifiée : identifiants Dishop expirés depuis le 20 juillet

Historique des synchronisations :

```text
13/07 : succès — 1 418 commandes importées
20/07 : succès — 1 400 commandes (dernière donnée : 15/07)
27/07 : ECHEC — 403 « Invalid client credentials » sur /v1/api/oauth/token
03/08 : ECHEC — idem
10/08 : ECHEC — idem
17/08 : ECHEC — idem
```

Conséquences visibles :

- La tuile « Dishop » affiche 62 831 € pour juillet 2026 alors que juin valait 145 927 € : seule la moitié de juillet existe en base.
- Rien n'arrive depuis le 15 juillet : tout août manque.
- De plus, 8 653 € de CA Dishop (≈ 600 commandes) ne remontent pas dans l'app car rattachés à aucun restaurant : boutiques `chickenstreet` (identifiant générique), `cs-belfort`, `cs-bordeaux-merignac`, `cs-lyon6`, `cs-dijon`, etc. Certains de ces restaurants ont un mapping créé après coup, sans reprise des anciennes lignes.

Le calcul de la tuile lui-même est correct : somme des montants TTC des commandes Dishop sur la période, par marque et restaurants sélectionnés.

## Correctifs proposés

1. **Action côté vous** : régénérer les identifiants client Dishop (client_id/client_secret) auprès de Dishop, puis nous les transmettre — nous les mettrons à jour dans la configuration de la connexion.
2. **Rattrapage** : dès les identifiants réparés, relancer l'import semaine par semaine du 20 juillet à aujourd'hui.
3. **Rattachement rétroactif** : réappliquer les mappings existants aux commandes orphelines, puis lister les boutiques réellement sans mapping (notamment `chickenstreet`, à qualifier avec vous) pour les créer.
4. **Affichage** : indiquer sur la tuile Dishop la date de dernière donnée disponible (ex. « données jusqu'au 15/07 ») quand elle ne couvre pas toute la période, pour éviter de lire un chiffre incomplet comme une baisse d'activité.

## Détails techniques

- Mise à jour du secret/config de la connexion Dishop, puis appels de `dishop-sync-week` pour chaque semaine manquante (les imports sont idempotents).
- Mise à jour ciblée de `dishop_orders` par jointure sur `dishop_shop_mapping` pour les orphelins.
- Requête max(order_date) par marque affichée en légende de la tuile dans `ChannelRevenueTiles.tsx` (aucun changement de calcul).

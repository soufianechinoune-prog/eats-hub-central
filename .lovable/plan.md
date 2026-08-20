# Splash Tasty Crousty : reconnexion et rattrapage des données manquantes

## Constat vérifié

- La connexion Splash Tasty Crousty est marquée active dans la plateforme (compte `soufiane@tastycrousty.io`, dernière mise à jour 20/07/2026).
- Les ventes sur place Tasty Crousty s'arrêtent au **31/07/2026** : aucune ligne en août, alors que Chicken Street est à jour au 20/08/2026.
- Test d'authentification direct sur Splash360 ce jour :
  - Chicken Street (`franchise@chickenstreet.fr`) : succès (token délivré).
  - Tasty Crousty (`soufiane@tastycrousty.io` / mot de passe actuellement stocké) : **échec** (erreur serveur côté Splash, typique d'un compte désactivé ou d'un mot de passe modifié).

Conclusion : ce ne sont pas les mappings (69 boutiques TC rattachées) ni le job de sync qui bloquent — ce sont les identifiants Splash Tasty Crousty qui ne fonctionnent plus.

## Ce qu'il faut de ta part

Obtenir auprès de Splash360 (ou du compte TC) des identifiants valides : soit réactivation du compte `Soufiane@tastycrousty.io`, soit un nouveau mot de passe / un compte franchise dédié avec accès à toutes les boutiques TC.

## Plan une fois les nouveaux identifiants disponibles

1. Mettre à jour les identifiants de la connexion Splash Tasty Crousty (stockés côté backend, jamais exposés dans le front).
2. Vérifier immédiatement l'authentification et l'accès à la liste des boutiques TC (contrôle que les 69 boutiques mappées répondent bien).
3. Relancer un backfill Splash Tasty Crousty du **01/08/2026 à aujourd'hui**, par lots journaliers, avec suivi de progression.
4. Contrôler la couverture : nombre de jours-restaurant remplis en août, comparaison du CA quotidien avec le dashboard Splash sur 2-3 restaurants témoins.
5. Confirmer que la sync quotidienne repart automatiquement les jours suivants.

## Détails techniques

- Connexion concernée : ligne `chain_pos_connections` du connecteur `splash360` pour la chaîne Tasty Crousty.
- Backfill via les jobs Splash existants (mêmes mécanismes que le rattrapage Chicken Street), pas d'insertion manuelle.
- Aucune modification des règles d'isolation par marque : les triggers refusant tout mapping/ventes cross-marque restent en place.

## Réponse courte

Pour Chicken Street au **12/06**, la data ne remonte pas parce que le sync Splash a bien créé les lignes en base, mais avec **0 € / 0 commande**. Ce ne sont pas des vraies ventes à zéro : ce sont des lignes fantômes créées pendant la panne du sync Splash entre le 7 et le 14 juin.

Ce que j’ai vérifié :

- Chicken Street a des lignes Splash le **12/06** et le **13/06**.
- Mais elles sont toutes à **0 €** et **0 commande**.
- Leur dernière mise à jour date du **07/06**, donc elles n’ont pas été rafraîchies depuis la panne.
- Depuis le correctif de ce matin, le live Splash fonctionne seulement sur **aujourd’hui + hier** en agrégat réseau, donc il a corrigé le **14/06** et le **15/06**, mais pas encore le **12/06**.

## Pourquoi l’écran affiche 0

La vue “Caisse” filtre les lignes Splash utiles pour le comparatif restaurants. Comme le 12/06 contient uniquement des lignes à zéro, l’interface affiche :

- CA Caisse : vide / `--`
- Comparatif restaurants : `0 restos`
- Variation N-1 : `-100 %`

Ce n’est donc pas un problème de date picker ou d’affichage : c’est bien la donnée Splash du 12/06 qui n’a pas été rechargée correctement.

## Plan d’action

### 1. Ajouter un backfill ciblé par jours
Modifier `sync-splash360` pour accepter une liste de jours précis, par exemple `12` et `13`, au lieu de relancer tout le mois complet.

### 2. Relancer Chicken Street sur le trou de données
Déclencher le backfill Splash Chicken Street sur :

- 08/06
- 09/06
- 10/06
- 11/06
- 12/06
- 13/06

### 3. Vérifier la donnée en base
Contrôler que les lignes Chicken Street ne sont plus à zéro sur le 12/06 :

- CA TTC > 0
- commandes > 0
- restaurants avec ventes > 0

### 4. Vérifier dans l’interface
Retourner sur Overview → Caisse → 12/06 et confirmer que :

- le CA Caisse remonte
- le tableau restaurants se remplit
- les `-100 %` disparaissent quand la donnée actuelle existe

## Résultat attendu

Après backfill, Chicken Street doit afficher les ventes Splash du **12 juin** et des autres jours manquants.
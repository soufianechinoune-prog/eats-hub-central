# Boutiques Uber non autorisées : test ciblé, sans surcharge

## Où on en est (vérifié à l'instant)

- La file de rattrapage est **vide** : 2 310 tâches terminées, 0 en attente, 0 en cours, 42 en échec. Rien ne tourne, donc on peut lancer un petit test sans risque de saturer Uber.
- Les 172 boutiques avec un identifiant Uber ont toutes été testées. **7 seulement sont encore refusées** :
  - Chicken Street Armentières (fermé), Avignon (fermé), Metz Muse (fermé), Toulon (fermé), Strasbourg (actif)
  - Tasty Crousty Creil (actif), Tasty Crousty Marseille Garibaldi (actif)
- Point important : **aucune des 29 boutiques de ton mail à Sanjay n'est dans cette liste de refus**. Les 26 à provisionner + les 3 à réactiver passent déjà le test d'autorisation côté Uber.

## Ce que je propose

Uber n'a envoyé qu'un accusé de réception, pas une confirmation. Mais comme les 29 boutiques répondent déjà OK, il n'y a rien à attendre pour elles.

### Étape 1 — Test ciblé (immédiat, très léger)
Relancer le contrôle d'autorisation uniquement sur les **7 boutiques encore refusées**, une par une avec ~2 s d'écart, sans mise en file d'historique. Durée : moins d'une minute, aucun risque de blocage Uber.

### Étape 2 — Selon le résultat
- Boutique qui repasse OK → remettre son historique juin → août en file, en priorité basse (après l'import quotidien), au débit lent déjà en place (2 rapports/minute).
- Boutique toujours refusée → je te donne la liste nominative (nom, identifiant Uber, enseigne, ouvert/fermé) à renvoyer à Sanjay. Les 4 fermées peuvent être écartées de la demande : elles n'ont plus de volume.

### Étape 3 — Vérification de couverture
Contrôler que les 29 boutiques du mail ont bien leurs versements août complets ; si des trous subsistent, les ré-enfiler par semaines, toujours en priorité basse.

## Ma recommandation

On ne « attend » pas : on lance l'étape 1 tout de suite (7 appels, c'est négligeable), et on garde en réserve la relance d'historique tant qu'Uber n'a pas confirmé pour les éventuels refus restants.

## Détails techniques

- `uber-authorize-audit` appelé avec `storeIds` = les 7 UUID refusés, `delayMs: 2000`, `reenqueue: false` pour le test.
- Deuxième appel avec `reenqueue: true` uniquement pour les boutiques repassées OK (fenêtres hebdo juin → août, `vague = 1200`).
- Aucun changement des règles de calcul des versements, ni du pacing du worker (2 jobs/tick sur vague ≥ 1000, frein 429 déjà actif).

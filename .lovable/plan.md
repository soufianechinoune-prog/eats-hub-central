Constat en base :

- Chicken Street Argenteuil a 69 220 commandes, dont 0 taguées `uber_api`.
- Chicken Street Orléans a 41 325 commandes, dont 0 taguées `uber_api`.
- Pourtant, les jobs `PAYMENT_DETAILS_REPORT` sont bien `done` de janvier 2024 à mai 2026 pour les deux restaurants.
- Donc le problème n’est pas l’API Uber : les jobs API existent bien. Le problème est le retag qui n’a pas modifié les commandes existantes.

Pourquoi ça reste affiché “Historique” :

- La page affiche “Live” seulement si les commandes du mois ont `data_source = 'uber_api'`, ou si elle trouve un job `done` pour ce mois.
- Pour Argenteuil et Orléans, les commandes sont encore avec `data_source = NULL`.
- La fonction de resynchronisation actuelle devrait les passer en `uber_api`, mais elle semble ne pas l’avoir fait sur ces deux gros volumes.
- Il y a bien environ 69 208 commandes éligibles à retagger pour Argenteuil et 41 322 pour Orléans.

Plan de correction :

1. Remplacer la resynchronisation globale par une version ciblable par restaurant.
   - Objectif : pouvoir retagger Argenteuil et Orléans séparément, au lieu de relancer toute la base.
   - Avantage : moins de risque de timeout/verrou, et résultat plus lisible.

2. Corriger la logique SQL pour retagger uniquement les commandes couvertes par un job `PAYMENT_DETAILS_REPORT` déjà terminé.
   - Argenteuil : janvier 2024 à mai 2026.
   - Orléans : janvier 2024 à mai 2026.
   - Les quelques commandes de décembre 2023 resteraient “Historique”, car aucun job API de décembre 2023 n’existe.

3. Ajouter/adapter l’interface du bouton pour afficher clairement :
   - combien de commandes ont été retaggées,
   - quels restaurants ont réussi,
   - quels restaurants sont bloqués ou en erreur,
   - et rafraîchir les données de la page après succès.

4. Après validation, vérifier en base que :
   - Argenteuil passe d’environ 0 à 69k commandes `uber_api`,
   - Orléans passe d’environ 0 à 41k commandes `uber_api`,
   - les mois concernés affichent bien “Live”.

En vulgarisé : l’API Uber a bien ramené les données, mais l’étiquette collée sur les anciennes commandes n’a pas changé. La page voit encore l’ancienne étiquette vide, donc elle écrit “Historique”. Il faut refaire le collage d’étiquette, mais de façon ciblée et plus robuste pour ces gros restaurants.
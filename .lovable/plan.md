

## Analyse : les chiffres affichés sont corrects, mais filtrés

### Constat

Le CA Deliveroo 2025 affiché de **1 822 159 €** est **mathématiquement exact** — j'ai vérifié en base de données et obtiens exactement la même valeur (1 822 159,43 €).

**Mais** ce chiffre correspond aux **14 restaurants épinglés**, pas à tout le réseau.

Sur ton screenshot, le toggle "Épinglés 14 / Réseau 91" est positionné sur **Épinglés**. Donc le tableau filtre sur 14 restaurants seulement.

### Vérification en base

| Périmètre | CA Deliveroo 2025 | Commandes |
|---|---|---|
| **14 épinglés** (affiché) | 1 822 159 € | 87 327 |
| **Réseau complet** (91 restaurants) | 7 704 234 € | 369 141 |

Le chiffre affiché est donc correct pour le filtre actif. Pour voir le CA de tout le réseau, il suffit de basculer le toggle sur **"Réseau"**.

### Écart entre deux vues ?

Si tu compares deux vues (ex: Overview vs Finances, ou Mois vs Année) et que tu observes des écarts, les causes possibles sont :

1. **Toggle Épinglés/Réseau** différent entre les deux vues — vérifier que les deux sont sur le même mode
2. **Source de données différente** — l'Overview utilise la table `orders` (par date de commande), les Finances utilisent la table `payouts` (par date de versement) pour Uber, et `deliveroo_orders` pour Deliveroo
3. **Sélecteur de restaurant** — "Tous les restaurants" dans le dropdown ne suffit pas, le toggle Épinglés/Réseau prime

### Action recommandée

Pas de changement de code nécessaire. Bascule le toggle sur **"Réseau"** pour voir les chiffres du réseau complet, et vérifie que les deux vues que tu compares utilisent le même état de filtre.

Si après vérification tu constates toujours un écart entre deux vues spécifiques avec le même filtre, envoie-moi les deux screenshots et je diagnostiquerai la source exacte de la différence.


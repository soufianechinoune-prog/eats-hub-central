

## Correction des noms en base

Deux restaurants ont des noms incorrects dans la table `restaurants` :

| Actuel (DB) | Corrigé |
|---|---|
| Chicken Street - Goussainvillie | Chicken Street - Goussainville |
| Chicken Street - Creteil | Chicken Street - Créteil |

### Action

Exécuter deux `UPDATE` sur la table `restaurants` pour corriger les noms. Utiliser l'outil d'insertion (pas de migration, car c'est une modification de données, pas de schéma).

Cela résoudra le matching dans **tous** les parsers d'un coup, sans modifier de code.


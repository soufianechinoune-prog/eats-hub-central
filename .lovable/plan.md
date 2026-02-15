
# Corriger l'auto-detection du type "Commandes incorrectes"

## Le probleme

Ton fichier CSV "Commandes incorrectes" contient les colonnes "Id. de la commande" et "Heure de la commande". Ces colonnes sont aussi presentes dans les fichiers "Historique des commandes". Or, dans le code, la detection de "Historique des commandes" est testee **avant** "Commandes incorrectes", donc le systeme identifie ton fichier a tort comme un historique.

Resultat : il te demande de selectionner un restaurant (car "Historique des commandes" l'exige), alors que "Commandes incorrectes" ne l'exige pas et sait identifier les restaurants automatiquement.

## La solution

Inverser l'ordre de detection dans le code : tester d'abord "Commandes incorrectes" (marqueurs plus specifiques : "Probleme avec la commande" + "Client rembourse"), puis "Historique des commandes".

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/pages/ReportImport.tsx` | Deplacer le bloc de detection `inaccurate_orders` (lignes 464-468) AVANT le bloc `order_history` (lignes 459-462) |

## Detail technique

Ordre actuel (lignes 459-468) :

```text
// Order History (ligne 459-462) -- TESTE EN PREMIER, gagne a tort
if ("Id. de la commande" + "Heure de la commande") -> order_history

// Inaccurate Orders (ligne 464-468) -- jamais atteint
if ("Probleme avec la commande" + "Client rembourse") -> inaccurate_orders
```

Nouvel ordre :

```text
// Inaccurate Orders -- TESTE EN PREMIER (marqueurs plus specifiques)
if ("Probleme avec la commande" + "Client rembourse") -> inaccurate_orders

// Order History -- teste ensuite
if ("Id. de la commande" + "Heure de la commande") -> order_history
```

Aucun changement backend, aucun impact sur les autres types d'import.



# Activer le chunking pour l'import des rapports de paiement

## Le probleme

Le fichier "Paiements (commandes)" est envoye en un seul bloc a la fonction `parse-payment-report`. Comme ce fichier contient potentiellement des milliers de lignes (toutes les commandes de tous les restaurants), il depasse la limite memoire de la fonction backend (256 MB) et crash avec l'erreur "Memory limit exceeded".

Le chunking (decoupe par lots de 15 000 lignes) est deja implementee pour `order_history` et `inaccurate_orders` mais **pas** pour `payment_order_level` ni `payment_item_level`.

## La solution

Ajouter `payment_order_level` et `payment_item_level` a la liste des types de rapports qui beneficient du chunking, aussi bien pour la phase de validation (dry run avec echantillon) que pour la phase d'import (lots de 15 000 lignes).

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/pages/ReportImport.tsx` | Ajouter `payment_order_level` et `payment_item_level` aux deux constantes `LARGE_FILE_REPORT_TYPES` (validation + import) |

## Detail technique

### Changement 1 : Phase validation (dry run) - ligne ~743

```text
// Avant
const LARGE_FILE_REPORT_TYPES = ["order_history", "inaccurate_orders"];

// Apres
const LARGE_FILE_REPORT_TYPES = ["order_history", "inaccurate_orders", "payment_order_level", "payment_item_level"];
```

### Changement 2 : Phase import - ligne ~912

Meme modification sur la deuxieme occurrence de `LARGE_FILE_REPORT_TYPES`.

### Pourquoi ca suffit

Le mecanisme de chunking existant est deja generique :
1. Il decoupe le CSV en lots de 15 000 lignes
2. Il envoie chaque lot avec le header au bon edge function (via `functionMap`)
3. Il agrege les resultats (inseres, erreurs, restaurants inconnus)
4. Il affiche la barre de progression

Les fonctions `parse-payment-report` et `parse-item-report` supportent deja les imports partiels car elles font des `upsert` sur `uber_order_id`.

Aucune modification des edge functions n'est necessaire.


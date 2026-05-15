# Constat vérifié dans ton CSV

J’ai recalculé directement le fichier brut que tu as envoyé :

| Colonne CSV | Total trouvé |
|---|---:|
| **Total des ventes d'articles, TVA incluse** | **57 711,32 €** |
| **Versement par l'entité tierce de titres-restaurant** | **5 519,44 €** |
| **Montant total correspondant à la commande** | **29 097,08 €** |

Donc le vrai versement bancaire Uber doit être :

```text
29 097,08 € + 5 519,44 € = 34 616,52 €
```

Tu as raison : les **35 069 €** affichés ne viennent pas du CSV brut.

# Cause probable

Le parser ne reconnaît pas parfaitement les nouveaux intitulés longs du CSV Uber Manager.

Dans ton fichier, la colonne du net s’appelle :

```text
Montant total correspondant à la commande (négatif en cas de remboursement) ... +/- Autres paiements
```

Mais le mapping actuel cherche surtout :

```text
Montant total
```

Résultat : sur certains imports, le système peut retomber sur une ancienne valeur déjà présente ou mal mapper une colonne proche, ce qui explique l’écart.

# Plan de correction

1. **Renforcer le mapping du parser Uber**
   - Mapper explicitement l’intitulé long de la colonne `Montant total correspondant à la commande...` vers `net_payout`.
   - Mapper explicitement l’intitulé long de la colonne `Versement par l'entité tierce de titres-restaurant...` vers `meal_voucher_amount`.
   - Mapper explicitement l’intitulé long du CA TTC vers `sales_incl_vat`.

2. **Ajouter une validation post-import**
   - Le parser devra retourner dans le résultat d’import :
     - total CA TTC CSV
     - total montant versé TTC CSV
     - total titres-restaurant CSV
     - total attendu versement = montant versé TTC + titres-restaurant
   - Comme ça, après import, on pourra voir immédiatement si le fichier donne bien **34 616,52 €**.

3. **Réimporter février Argenteuil proprement**
   - Wipe ciblé uniquement sur Chicken Street Argenteuil février.
   - Réimport du CSV corrigé.
   - Vérification attendue dans l’Overview :
     - CA Uber : **57 711,32 €**
     - Titre restaurant : **5 519,44 €**
     - Versement Uber : **34 616,52 €**

4. **Garder la colonne “Titre restaurant” affichée**
   - Elle reste utile pour comprendre la décomposition :

```text
Versement Uber = Montant total CSV + Titre restaurant CSV
```

# Résultat attendu

La ligne Uber Eats Argenteuil février devra afficher environ :

```text
CA: 57 711,32 €
Versement: 34 616,52 €
Titre restaurant: 5 519,44 €
```

et non plus 35 069 €.
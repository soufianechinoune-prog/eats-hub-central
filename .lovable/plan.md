

## Configurer Ivry : ancien UUID + nettoyage doublon

### Contexte
Ivry a change d'UUID Uber Eats fin avril 2020 :
- **Ancien** : `91dcc91f-46ac-47ce-8ec9-29d67b096072` (09/2019 - 04/2020)
- **Actuel** : `cad7861d-bd22-4c66-83d9-f7ecd6821e08` (04/2020 - aujourd'hui)

Un doublon existe en base : la fiche "CHICKEN STREET IVRY-SUR-SEINE" (`1ae214f7...`) sans UUID, creee probablement lors d'un ancien import. Ses 111 commandes sont toutes deja presentes dans la fiche principale "Chicken Street - Ivry" (`d0390bba...`).

### Actions (migration SQL uniquement, aucun code a modifier)

**Etape 1 : Lier l'ancien UUID a la fiche principale**

```text
restaurant_uber_ids
+--------------------------------------------+
| restaurant_id : d0390bba-eb43-4f86-955f-8cffd8caa9b1 (Ivry)
| uber_store_id : 91dcc91f-46ac-47ce-8ec9-29d67b096072
| is_primary    : false
| label         : "ancien UUID - ferme 27/04/2020"
+--------------------------------------------+
```

**Etape 2 : Corriger la date d'ouverture**
- `uber_opening_date` : de `2020-04-20` vers `2019-09-13` (date reelle de premiere commande)

**Etape 3 : Supprimer le doublon `1ae214f7...`**
- Supprimer les 111 lignes `order_history` du doublon (toutes redondantes, confirmees par matching sur `uber_order_id`)
- Supprimer la fiche restaurant doublon

### Impact
- Les imports CSV historiques avec l'ancien store_id `91dcc91f...` seront automatiquement rattaches au bon restaurant
- Plus de doublon dans la liste des restaurants
- Historique consolide sur une seule fiche

### Detail technique
- Migration SQL : INSERT dans `restaurant_uber_ids`, UPDATE `uber_opening_date`, DELETE `order_history` du doublon, DELETE restaurant doublon
- Aucune modification de code


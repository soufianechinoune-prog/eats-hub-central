

## Configurer Meaux : ancien UUID pour matching historique

### Contexte
Chicken Street - Meaux a change d'UUID Uber Eats le 18/06/2024 :
- **Ancien** : `d369c6e7-a2c1-5788-b5ea-ffbaf3202d72` (10/2021 - 06/2024, marque DEPRECATED)
- **Actuel** : `23243ab1-ded7-5656-a581-8cc9d1a3b0c4` (06/2024 - aujourd'hui)

Actuellement, seul l'UUID actuel est configure en base. Pas de doublon detecte.

### Actions (migration SQL uniquement, aucun code a modifier)

**Etape 1 : Lier l'ancien UUID a la fiche principale**

```text
restaurant_uber_ids
+--------------------------------------------+
| restaurant_id : 3103038f-800f-4d79-b637-88a68aae39b7 (Meaux)
| uber_store_id : d369c6e7-a2c1-5788-b5ea-ffbaf3202d72
| is_primary    : false
| label         : "ancien UUID - ferme 18/06/2024"
+--------------------------------------------+
```

**Etape 2 : Corriger la date d'ouverture**
- `uber_opening_date` : de `2022-09-29` vers `2021-10-27` (date reelle de premiere commande selon le CSV)

### Impact
- Les imports CSV historiques (octobre 2021 - juin 2024) avec l'ancien store_id `d369c6e7...` seront automatiquement rattaches au bon restaurant
- Historique consolide sur une seule fiche

### Detail technique
- Migration SQL : INSERT dans `restaurant_uber_ids` + UPDATE de `uber_opening_date` sur `restaurants`
- Aucune modification de code necessaire


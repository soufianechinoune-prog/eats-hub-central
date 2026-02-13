

## Configurer Villefranche : ancien UUID pour matching historique

### Contexte
Villefranche-sur-Saone a change d'UUID Uber Eats le 08/02/2024 :
- **Ancien** : `e1a89083-8624-54c4-9ee2-50a99b405574` (06/2023 - 02/2024, marque DEPRECATED)
- **Actuel** : `005a2d0d-96e7-525e-ab38-41193de5cd7e` (02/2024 - aujourd'hui)

Actuellement, seul l'UUID actuel est configure en base. Pas de doublon detecte.

### Actions (migration SQL uniquement, aucun code a modifier)

**Etape 1 : Lier l'ancien UUID a la fiche principale**

```text
restaurant_uber_ids
+--------------------------------------------+
| restaurant_id : 7071835b-c364-4840-ba7e-8f252b140feb (Villefranche)
| uber_store_id : e1a89083-8624-54c4-9ee2-50a99b405574
| is_primary    : false
| label         : "ancien UUID - ferme 08/02/2024"
+--------------------------------------------+
```

**Etape 2 : Corriger la date d'ouverture**
- `uber_opening_date` : de `2024-02-09` vers `2023-06-19` (date reelle de premiere commande selon le CSV)

### Impact
- Les imports CSV historiques (juin 2023 - fevrier 2024) avec l'ancien store_id `e1a89083...` seront automatiquement rattaches au bon restaurant
- Historique consolide sur une seule fiche

### Detail technique
- Migration SQL : INSERT dans `restaurant_uber_ids` + UPDATE de `uber_opening_date` sur `restaurants`
- Aucune modification de code necessaire

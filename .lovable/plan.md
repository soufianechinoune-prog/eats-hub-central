

## Configurer Nantes : ancien UUID pour matching historique

### Contexte
Chicken Street - Nantes a changé d'UUID Uber Eats fin décembre 2022 :
- **Ancien** : `0ed5bfaa-27be-446a-8c86-478238af85d2` (02/2021 - 12/2022, marqué DEPRECATED)
- **Actuel** : `7cefab18-6a46-5203-bcbc-473c1b516ad7` (12/2022 - aujourd'hui)

Actuellement, seul l'UUID actuel est configuré en base. Pas de doublon détecté. Nantes Centre est un restaurant distinct, non concerné.

### Actions (migration SQL uniquement, aucun code à modifier)

**Etape 1 : Lier l'ancien UUID à la fiche principale**

```text
restaurant_uber_ids
+--------------------------------------------+
| restaurant_id : 95b1acd2-8dec-47ba-b3fe-e78f877212fc (Nantes)
| uber_store_id : 0ed5bfaa-27be-446a-8c86-478238af85d2
| is_primary    : false
| label         : "ancien UUID - fermé 28/12/2022"
+--------------------------------------------+
```

**Etape 2 : Corriger la date d'ouverture**
- `uber_opening_date` : de `2023-03-14` vers `2021-02-07` (date réelle de première commande selon le CSV)

### Impact
- Les imports CSV historiques (février 2021 - décembre 2022) avec l'ancien store_id `0ed5bfaa...` seront automatiquement rattachés au bon restaurant
- Historique consolidé sur une seule fiche
- Nantes Centre reste inchangé

### Détail technique
- Migration SQL : INSERT dans `restaurant_uber_ids` + UPDATE de `uber_opening_date` sur `restaurants`
- Aucune modification de code nécessaire


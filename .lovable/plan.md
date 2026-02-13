

## Ajouter l'ancien UUID de Montreuil pour le matching historique

### Contexte
Montreuil a change d'UUID Uber Eats le 10/12/2020 :
- **Ancien** : `f6cb4dd0-8542-40e9-87c6-1a0aa60d6076` (01/2019 - 12/2020)
- **Actuel** : `bb1e1a0e-8d3e-4cc5-b7ad-944abfb206be` (12/2020 - aujourd'hui)

Actuellement, seul l'UUID actuel est configure. Les imports de fichiers historiques (avant 12/2020) ne pourront pas matcher car l'ancien UUID n'est pas enregistre.

### Action

Ajouter une entree dans `restaurant_uber_ids` pour lier l'ancien UUID au restaurant Montreuil existant :

```text
restaurant_uber_ids
+--------------------------------------------+
| restaurant_id : 1ffe6efa-d318-4e0b-993a-6c55ef3e1d44 (Montreuil)
| uber_store_id : f6cb4dd0-8542-40e9-87c6-1a0aa60d6076
| is_primary    : false
| label         : "ancien UUID - ferme 10/12/2020"
+--------------------------------------------+
```

Mettre a jour egalement les metadonnees du restaurant :
- `uber_opening_date` : corriger de `2019-11-07` vers `2019-01-14` (date reelle de premiere commande selon le CSV)

### Impact
Apres cette configuration, tout import CSV contenant l'ancien store_id `f6cb4dd0...` sera automatiquement rattache au bon restaurant Montreuil, sans intervention manuelle.

### Detail technique
- **Migration SQL** : INSERT dans `restaurant_uber_ids` + UPDATE de `uber_opening_date` sur `restaurants`
- Aucune modification de code necessaire, le systeme de matching multi-UUID est deja en place



# Nettoyer le doublon Bonneuil

## Diagnostic

Le doublon (`bc673a23`, uber_store_id: `name:chicken street - bonneuil`) a ete cree le 6 fevrier 2026 par un import CSV. Le vrai Bonneuil (`9d1ebcb5`, UUID officiel: `723fa695-f889-4132-9c39-4fbe35d18c54`) existe depuis novembre 2025.

### Donnees du doublon
- **order_history** : 11 380 lignes dont 11 130 sont des doublons exacts et **250 sont uniques**
- **customer_reviews** : **757 avis uniques** (aout 2025 - jan 2026) - absents du vrai Bonneuil
- **restaurant_uber_ids** : 1 entree placeholder

## Plan d'action

### Etape 1 : Migrer les 250 commandes uniques vers le vrai Bonneuil

Transferer uniquement les commandes qui n'existent pas deja dans le vrai restaurant.

```sql
UPDATE order_history 
SET restaurant_id = '9d1ebcb5-2aac-4757-a431-0d2e5e4f9015'
WHERE restaurant_id = 'bc673a23-4c54-40d3-942c-b4c5ea44e85a'
AND NOT EXISTS (
  SELECT 1 FROM order_history oh2
  WHERE oh2.restaurant_id = '9d1ebcb5-2aac-4757-a431-0d2e5e4f9015'
  AND oh2.order_datetime = order_history.order_datetime
  AND oh2.order_amount = order_history.order_amount
);
```

### Etape 2 : Supprimer les 11 130 commandes en doublon

```sql
DELETE FROM order_history 
WHERE restaurant_id = 'bc673a23-4c54-40d3-942c-b4c5ea44e85a';
```

### Etape 3 : Migrer les 757 avis clients vers le vrai Bonneuil

```sql
UPDATE customer_reviews 
SET restaurant_id = '9d1ebcb5-2aac-4757-a431-0d2e5e4f9015'
WHERE restaurant_id = 'bc673a23-4c54-40d3-942c-b4c5ea44e85a';
```

### Etape 4 : Supprimer le mapping placeholder

```sql
DELETE FROM restaurant_uber_ids 
WHERE restaurant_id = 'bc673a23-4c54-40d3-942c-b4c5ea44e85a';
```

### Etape 5 : Supprimer le doublon

```sql
DELETE FROM restaurants 
WHERE id = 'bc673a23-4c54-40d3-942c-b4c5ea44e85a';
```

### Resultat attendu
- Le vrai Bonneuil aura ~15 969 commandes (15 719 + 250) et 1 051 avis (294 + 757)
- Plus de doublon dans la liste des restaurants
- Aucune perte de donnees


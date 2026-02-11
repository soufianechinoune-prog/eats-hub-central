

# Nettoyer le doublon Juvisy

## Origine du probleme
Le doublon (id: `7ba462d6`, uber_store_id: `name:chicken street - juvisy`) a ete cree le 6 fevrier 2026 par un import CSV qui n'a pas reconnu le restaurant. Il a genere un placeholder au lieu de rattacher les donnees au vrai Juvisy (id: `8e4026f9`, UUID: `051979ae-34a3-4ddc-9ac0-d430efdcc0a5`).

## Donnees liees au doublon
- **order_history** : 8 959 lignes (sept 2025 - janv 2026)
- **restaurant_uber_ids** : 1 entree placeholder
- Toutes les autres tables : 0 donnees

Le vrai Juvisy a deja 14 452 lignes dans order_history.

## Plan d'action

### Etape 1 : Migrer les commandes vers le bon restaurant
Transferer les 8 959 lignes de `order_history` du doublon (`7ba462d6`) vers le vrai Juvisy (`8e4026f9`).

```sql
UPDATE order_history 
SET restaurant_id = '8e4026f9-88dd-4932-98fd-8db44c88e02d' 
WHERE restaurant_id = '7ba462d6-5b27-4531-9696-5c565bcfe4e5';
```

### Etape 2 : Supprimer l'entree de mapping placeholder

```sql
DELETE FROM restaurant_uber_ids 
WHERE restaurant_id = '7ba462d6-5b27-4531-9696-5c565bcfe4e5';
```

### Etape 3 : Supprimer le doublon

```sql
DELETE FROM restaurants 
WHERE id = '7ba462d6-5b27-4531-9696-5c565bcfe4e5';
```

### Resultat attendu
- Le vrai Juvisy aura ~23 411 lignes dans order_history (14 452 + 8 959)
- Plus de doublon dans la liste des restaurants
- Aucune perte de donnees


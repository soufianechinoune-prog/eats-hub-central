

## Fermeture de Chicken Street - Clermont-Ferrand

Mise a jour de la fiche restaurant pour refleter la fermeture constatee dans le CSV maitre Uber Eats.

### Restaurant concerne

| Champ | Valeur actuelle | Nouvelle valeur |
|---|---|---|
| Restaurant | Chicken Street - Clermont-Ferrand | - |
| UUID | 73ac0e25-c5b4-586a-8105-577d38bdc401 | - |
| is_active | true | **false** |
| uber_closing_date | NULL | **2025-12-09** |

### Action

Executer la requete SQL suivante :

```sql
UPDATE restaurants 
SET is_active = false, uber_closing_date = '2025-12-09' 
WHERE uber_store_id = '73ac0e25-c5b4-586a-8105-577d38bdc401';
```

Aucune modification de code necessaire. Le badge "Ferme" s'affichera automatiquement sur la page /restaurants grace a la logique de statut existante.




## Objectif
Ajouter `c.soufiane@chickenstreet.fr` comme `super_admin` dans `user_chain_access`.

## Migration SQL

```sql
INSERT INTO public.user_chain_access (user_id, chain_id, role)
SELECT id, NULL, 'super_admin' 
FROM auth.users 
WHERE email = 'c.soufiane@chickenstreet.fr'
ON CONFLICT (user_id, chain_id) DO NOTHING;
```

## Détails
- Utilisation du **insert tool** (pas migration) car c'est une opération de données, pas un changement de schéma
- `ON CONFLICT DO NOTHING` évite les doublons si déjà présent
- Aucun changement de code nécessaire


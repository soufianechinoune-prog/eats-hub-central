

## Objectif
Appliquer les RLS chain-scopées sur les 2 dernières tables : `menu_items` et `scheduled_messages`.

## Migration SQL

```sql
-- ============================================
-- 1. menu_items — pattern standard via restaurant_id
-- ============================================
DROP POLICY IF EXISTS "Allow read menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow insert menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow update menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow delete menu_items for all" ON public.menu_items;

CREATE POLICY "Chain scoped access on menu_items" ON public.menu_items
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)
    )
  )
  WITH CHECK (
    is_super_admin() OR restaurant_id IN (
      SELECT id FROM public.restaurants WHERE user_has_chain_access(chain_id)
    )
  );

-- ============================================
-- 2. scheduled_messages — accès super_admin + importer uniquement
-- ============================================
DROP POLICY IF EXISTS "Authenticated full access on scheduled_messages" ON public.scheduled_messages;

CREATE POLICY "Import role access on scheduled_messages" ON public.scheduled_messages
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR get_user_role() = 'importer'
  )
  WITH CHECK (
    is_super_admin() OR get_user_role() = 'importer'
  );
```

## Résultat
- **menu_items** : accès restreint par chain via `restaurant_id → restaurants.chain_id`
- **scheduled_messages** : accès restreint aux rôles `super_admin` et `importer` (les clients sont exclus)
- **Total après migration** : 44 tables sécurisées

## Aucun changement de code
Migration SQL uniquement.


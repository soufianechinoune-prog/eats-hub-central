
-- 1. menu_items — lecture pour tous, écriture super_admin/importer
DROP POLICY IF EXISTS "Allow read menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow insert menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow update menu_items for all" ON public.menu_items;
DROP POLICY IF EXISTS "Allow delete menu_items for all" ON public.menu_items;

CREATE POLICY "Read menu_items for authenticated" ON public.menu_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Write menu_items for importers" ON public.menu_items
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR get_user_role() = 'importer');

CREATE POLICY "Update menu_items for importers" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR get_user_role() = 'importer')
  WITH CHECK (is_super_admin() OR get_user_role() = 'importer');

CREATE POLICY "Delete menu_items for importers" ON public.menu_items
  FOR DELETE TO authenticated
  USING (is_super_admin() OR get_user_role() = 'importer');

-- 2. scheduled_messages — super_admin + importer uniquement
DROP POLICY IF EXISTS "Authenticated full access on scheduled_messages" ON public.scheduled_messages;

CREATE POLICY "Import role access on scheduled_messages" ON public.scheduled_messages
  FOR ALL TO authenticated
  USING (is_super_admin() OR get_user_role() = 'importer')
  WITH CHECK (is_super_admin() OR get_user_role() = 'importer');

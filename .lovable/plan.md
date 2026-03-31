

## Objectif
Créer les tables `subscriptions` et `restaurant_visibility_grants` pour la gestion des abonnements par restaurant (190€ HT/mois) et les autorisations de visibilité inter-franchisés. Ajouter une section "Facturation" dans /admin.

## Remarques / Points d'attention

1. **`CHECK` constraint sur `status`** : Postgres autorise les CHECK immutables comme celui-ci (pas de `now()`), donc c'est safe. Aucun problème de restauration.

2. **`payer_user_id REFERENCES auth.users(id)`** : Techniquement fonctionnel mais cohérent avec le pattern existant dans le projet (ex: `user_chain_access` référence aussi `auth.users`). Cependant, pour afficher l'email du payeur dans le tableau admin, il faudra joindre via l'edge function `admin-list-users` côté client (pas de join direct possible sur `auth.users` via le SDK).

3. **Pas de table `invoices`** : La demande actuelle couvre uniquement le suivi des abonnements actifs. Si vous avez besoin de tracer les factures mensuelles ou l'historique de paiement, ce sera une étape ultérieure.

4. **Visibilité grants vs chain access** : Les grants sont au niveau restaurant (granulaire), pas au niveau chain. C'est cohérent avec "un franchisé accorde la visibilité de SES restaurants".

## Migration SQL

```sql
-- 1. Table subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'trial')),
  monthly_price NUMERIC(10,2) NOT NULL DEFAULT 190.00,
  activated_at TIMESTAMPTZ DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Users see own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (payer_user_id = auth.uid());

-- 2. Table restaurant_visibility_grants
CREATE TABLE public.restaurant_visibility_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  granted_to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, granted_to_user_id)
);

ALTER TABLE public.restaurant_visibility_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages grants" ON public.restaurant_visibility_grants
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Users see grants they gave or received" 
  ON public.restaurant_visibility_grants
  FOR SELECT TO authenticated
  USING (granted_by_user_id = auth.uid() OR granted_to_user_id = auth.uid());

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant_id 
  ON public.subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payer_user_id 
  ON public.subscriptions(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
  ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_visibility_grants_restaurant 
  ON public.restaurant_visibility_grants(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_visibility_grants_granted_to 
  ON public.restaurant_visibility_grants(granted_to_user_id);
```

## Modification de `src/pages/Admin.tsx`

Ajouter une 3eme section Card "Facturation & Abonnements" avec :

### Tableau des abonnements
- Query : `supabase.from("subscriptions").select("*, restaurants(name, chains(name))")` 
- Email du payeur : croisé avec la liste `usersData.users` (déjà fetchée)
- Colonnes : Restaurant | Marque | Payeur | Prix/mois | Statut | Activation | Actions (supprimer/désactiver)

### Formulaire "Activer un abonnement"
- Select restaurant (query `restaurants` avec nom + chain)
- Select payeur (depuis `usersData.users`)
- Input prix (default 190)
- Textarea notes
- Mutation : `supabase.from("subscriptions").insert({...})`

### Tableau des grants de visibilité
- Query : `supabase.from("restaurant_visibility_grants").select("*, restaurants(name)")`
- Emails croisés avec `usersData.users`
- Colonnes : Restaurant | Accordé à | Accordé par | Date | Actions (supprimer)

### Formulaire "Accorder visibilité"
- Select restaurant, Select "Accorder à", Select "Accordé par"
- Mutation : `supabase.from("restaurant_visibility_grants").insert({...})`

## Fichiers modifiés
- **Migration SQL** : 1 fichier (tables + RLS + index)
- **`src/pages/Admin.tsx`** : ajout section Facturation (~150 lignes)


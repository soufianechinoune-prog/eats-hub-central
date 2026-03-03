

# Support multi-mapping Deliveroo (comme Uber)

## Probleme

Le restaurant **Chicken Street - Nice** a deux noms differents dans les fichiers Deliveroo :
- `CHICKEN STREET - Nice 🌯` (deja configure)
- `CHICKEN STREET - Nice Promenade 🌯` (non reconnu)

Le champ `deliveroo_store_id` ne supporte qu'une seule valeur, contrairement a Uber qui a la table `restaurant_uber_ids` pour le multi-mapping.

## Solution

Creer une table `restaurant_deliveroo_ids` (identique au pattern `restaurant_uber_ids`) et adapter le parser pour l'utiliser.

### 1. Migration : creer `restaurant_deliveroo_ids`

```sql
CREATE TABLE public.restaurant_deliveroo_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  deliveroo_store_name text NOT NULL,
  is_primary boolean DEFAULT false,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deliveroo_store_name)
);

ALTER TABLE public.restaurant_deliveroo_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on restaurant_deliveroo_ids" ON public.restaurant_deliveroo_ids FOR ALL USING (true) WITH CHECK (true);

-- Migrer les deliveroo_store_id existants
INSERT INTO public.restaurant_deliveroo_ids (restaurant_id, deliveroo_store_name, is_primary, label)
SELECT id, deliveroo_store_id, true, 'principal'
FROM public.restaurants
WHERE deliveroo_store_id IS NOT NULL AND deliveroo_store_id != '';
```

### 2. Inserer le mapping manquant

```sql
INSERT INTO public.restaurant_deliveroo_ids (restaurant_id, deliveroo_store_name, is_primary, label)
VALUES ('b7b52b9d-...', 'CHICKEN STREET - Nice Promenade 🌯', false, 'ancien nom');
```
(L'ID exact sera lu depuis la base)

### 3. Modifier le parser Edge Function

Dans `supabase/functions/parse-deliveroo-statement/index.ts`, remplacer la resolution via `restaurants.deliveroo_store_id` par une requete sur `restaurant_deliveroo_ids` :

```typescript
// Avant
const { data: restaurants } = await supabase
  .from('restaurants')
  .select('id, name, deliveroo_store_id')
  .not('deliveroo_store_id', 'is', null);

// Apres
const { data: deliverooMappings } = await supabase
  .from('restaurant_deliveroo_ids')
  .select('restaurant_id, deliveroo_store_name');

// + fallback sur restaurants.deliveroo_store_id pour compatibilite
```

### 4. Adapter la page de matching Deliveroo

Dans `src/pages/DeliverooMatching.tsx`, utiliser aussi `restaurant_deliveroo_ids` pour afficher les correspondances existantes.

## Fichiers modifies
- `supabase/functions/parse-deliveroo-statement/index.ts` — resolution via nouvelle table
- `src/pages/DeliverooMatching.tsx` — lecture/ecriture dans `restaurant_deliveroo_ids`
- Migration SQL — creation table + migration donnees existantes


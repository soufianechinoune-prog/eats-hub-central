

## Objectif
Le badge "84" dans la sidebar compte les messages non lus de **toutes les marques** (y compris Chicken Street). Il faut filtrer par la chaîne active.

## Diagnostic
- `message_history` a une colonne `restaurant_id` (FK vers `restaurants`)
- `restaurants` a une colonne `chain_id`
- Le hook `useUnreadMessages` ne filtre pas par chaîne → il compte tout
- `AppSidebar.tsx` a déjà accès à `selectedChainId` via `useAnalyticsContext()`

## L'ingénieure a raison sur le fond, mais 2 ajustements

1. **Le "force rebuild" avec `// v2`** est inutile — Vite fait du HMR automatique. On ignore cette suggestion.
2. **Le JOIN via Supabase JS** est la bonne approche. Mais il faut aussi re-déclencher le `useEffect` quand `chainId` change (ajouter dans les deps).

## Modifications (2 fichiers)

### 1. `src/hooks/useUnreadMessages.ts`
- Accepter un paramètre optionnel `chainId: string | null`
- Si `chainId` est fourni : utiliser le filtre `restaurants!inner(chain_id)` + `.eq("restaurants.chain_id", chainId)`
- Si `chainId` est `null` : requête sans filtre chaîne (comportement actuel)
- Ajouter `chainId` dans les dépendances du `useEffect`

```typescript
export function useUnreadMessages(chainId?: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      let query = supabase
        .from("message_history")
        .select(
          chainId ? "*, restaurants!inner(chain_id)" : "*",
          { count: "exact", head: true }
        )
        .eq("direction", "inbound")
        .is("read_at", null);

      if (chainId) {
        query = query.eq("restaurants.chain_id", chainId);
      }

      const { count, error } = await query;
      if (!error && count !== null) {
        setUnreadCount(count);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [chainId]);

  return unreadCount;
}
```

### 2. `src/components/layout/AppSidebar.tsx` (ligne 179)
Passer `selectedChainId` au hook :
```typescript
const unreadCount = useUnreadMessages(selectedChainId);
```

## Impact
- Le badge ne comptera que les messages non lus des restaurants de la marque active
- Quand on change de marque, le compteur se met à jour immédiatement
- Aucune migration SQL nécessaire


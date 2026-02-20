

## Correction : Historique des imports ne charge pas (timeout DB)

### Diagnostic

La table `csv_imports` contient 996 lignes, ce qui est raisonnable. Le timeout survient parce que la base de donnees est encore sous pression apres le gros import d'articles (batches d'upsert sur `order_items` avec retries). Pendant cette periode de charge, meme les petites requetes peuvent depasser le delai.

### Corrections

**Fichier : `src/components/reports/ImportHistory.tsx`**

1. **Ajouter un `.limit(100)`** a la requete pour ne charger que les 100 derniers imports (largement suffisant pour l'historique visible). Cela reduit la charge et accelere la reponse.

2. **Ajouter un retry automatique** cote frontend : si la requete echoue (timeout), retenter une fois apres 2 secondes avant d'afficher l'erreur.

3. **Afficher un message d'erreur avec bouton "Reessayer"** au lieu d'un ecran vide quand la requete echoue, pour que l'utilisateur puisse retenter manuellement.

### Details techniques

```typescript
// Ligne 61 - Ajouter un limit
.order("imported_at", { ascending: false })
.limit(100);
```

```typescript
// Ajouter un retry automatique dans fetchImports
const { data, error } = await query;
if (error) {
  // Retry once after 2s on timeout
  await new Promise(r => setTimeout(r, 2000));
  const { data: retryData, error: retryError } = await query;
  if (retryError) throw retryError;
  setImports(retryData || []);
  return;
}
```

```typescript
// Ajouter un etat d'erreur pour afficher un bouton "Reessayer"
const [hasError, setHasError] = useState(false);
```

Avec un rendu conditionnel affichant un message d'erreur et un bouton de retry quand `hasError` est vrai.

### Resultat attendu

- Chargement plus rapide grace au limit
- Retry automatique en cas de timeout temporaire
- Message clair avec bouton "Reessayer" si la DB est toujours surchargee

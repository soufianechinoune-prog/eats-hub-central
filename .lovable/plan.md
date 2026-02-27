

# Corriger l'import des fichiers Deliveroo + RPC incomplet

## Diagnostic

- Bussy a 5659 lignes Deliveroo en base, mais les plus recentes datent du **8 fevrier 2026**
- La vue d'ensemble affiche la semaine du 16-22 fevrier → zero donnees Deliveroo pour Bussy
- Les 7 fichiers en echec d'import contiennent les releves recents (apres le 9 fevrier)
- Argenteuil a des donnees jusqu'au 22 fevrier → ligne Deliveroo visible

## Deux correctifs

### 1. Robustifier la lecture fichier dans `DeliverooImportTab.tsx`

La fonction `readFileAsText` a un `catch` silencieux qui masque l'erreur native du navigateur. Correctifs :

- Remplacer par une chaine de fallback : `file.arrayBuffer()` + `TextDecoder` → `FileReader.readAsText` → `FileReader.readAsArrayBuffer`
- Propager `error.name` et `error.message` dans le toast d'erreur
- Ajouter un message d'aide specifique pour `NotReadableError` (fermer Excel, copier en local hors iCloud/OneDrive/Drive)

### 2. Mettre a jour le RPC `get_network_deliveroo_summary`

Actuellement filtre `history_type = 'Livraison'` uniquement. Ajouter `'À emporter'` et `'Nouvelle livraison'` pour etre coherent avec l'agregation client.

```sql
WHERE d.history_type IN ('Livraison', 'À emporter', 'Nouvelle livraison')
```

## Fichiers modifies
- `src/components/reports/DeliverooImportTab.tsx` — readFileAsText + messages d'erreur
- Migration SQL — mise a jour du RPC




## Objectif
Ajouter un système de logos par marque : stockage, affichage dynamique dans la sidebar/header, et upload depuis la page Compte.

## Modifications

### 1. Migration SQL
- `ALTER TABLE public.chains ADD COLUMN IF NOT EXISTS logo_url TEXT;`
- Créer le bucket `chain-logos` (public)
- RLS sur `storage.objects` : lecture publique, écriture pour utilisateurs authentifiés

### 2. `src/components/layout/AppSidebar.tsx`
- Modifier la query `chains-list` pour inclure `logo_url` : `.select("id, name, logo_url")`
- **Header sidebar (lignes 298-308)** : remplacer le logo CS fixe par un composant dynamique :
  - Si `selectedChainId` et chain a un `logo_url` → afficher le logo de la chaîne (32×32, rounded-md)
  - Si `selectedChainId` sans logo → afficher les initiales de la chaîne dans un avatar
  - Si pas de chaîne → garder le logo CS actuel + "CS Delivery Performance"
- **Select chain (lignes 316-323)** : ajouter le mini logo de chaque chaîne dans les options du Select

### 3. `src/components/layout/AppLayout.tsx`
- Modifier la query `chain-name-header` pour inclure `logo_url` : `.select("name, logo_url")`
- **Header (lignes 41-45)** : afficher le logo de la chaîne (36×36, rounded-md) s'il existe, sinon garder le logo CS par défaut

### 4. `src/pages/Account.tsx`
- Ajouter les imports nécessaires (useIsSuperAdmin, useAnalyticsContext, Upload icon)
- Charger les données de la chaîne active (ou la seule chaîne du client)
- Ajouter une Card "Logo de ma marque" visible pour :
  - `super_admin` (toujours, utilise `selectedChainId`)
  - `client` avec exactement 1 chaîne
- Fonctionnalités :
  - Affiche le logo actuel ou un placeholder
  - Bouton "Changer le logo" → input file (PNG, JPG, WebP, max 2MB)
  - Upload vers bucket `chain-logos/{chainId}.{ext}`
  - Met à jour `chains.logo_url` avec l'URL publique
  - Invalide les queries `chains-list` et `chain-name-header`

### Fichiers modifiés
- 1 migration SQL (alter table + bucket + RLS)
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/pages/Account.tsx`


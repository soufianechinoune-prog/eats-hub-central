

## Plan : Logo dynamique par marque dans les exports PDF

### Contexte
Actuellement, **tous les PDF exportés** (inactivité, rentabilité, overview, menu, rapports hebdo) utilisent le logo CS en dur (`cs-logo.jpeg`). La marque sélectionnée a pourtant un `logo_url` stocké dans la table `chains` et affiché dans le header/sidebar.

### Approche
Créer une **fonction utilitaire partagée** qui charge le logo de la marque active, avec fallback sur le logo CS si aucun logo n'est configuré.

### Détail technique

**1. Nouveau helper : `src/lib/pdfLogoHelper.ts`**
- Fonction `loadChainLogoBase64(chainId: string | null): Promise<string>`
- Si `chainId` existe → fetch `chains.logo_url` depuis Supabase
- Si `logo_url` trouvé → fetch l'image, convertir en base64
- Sinon → fallback sur le logo CS local (`cs-logo.jpeg`)
- Cache en mémoire pour éviter les re-fetch dans la même session

**2. Mise à jour des 5 hooks d'export PDF**
Remplacer `import csLogoUrl from "@/assets/cs-logo.jpeg"` + `loadLogoBase64()` par un appel à `loadChainLogoBase64(selectedChainId)` dans :
- `src/hooks/useDowntimeExport.ts`
- `src/hooks/useReportPdfExport.ts`
- `src/hooks/useOverviewExport.ts`
- `src/hooks/useProfitabilityPdfExport.ts`
- `src/pages/MenuItems.tsx`

Chaque hook recevra `selectedChainId` via son composant parent (déjà disponible via `useAnalyticsContext`).

**3. Titre dynamique**
Remplacer aussi les textes "CS Delivery Performance" hardcodés dans les PDF par le nom de la marque active.

### Résultat
- Marque avec logo uploadé → son logo apparaît dans le PDF
- Marque sans logo → fallback logo CS
- Aucune marque sélectionnée → logo CS par défaut

### Fichiers modifiés
- `src/lib/pdfLogoHelper.ts` (nouveau)
- `src/hooks/useDowntimeExport.ts`
- `src/hooks/useReportPdfExport.ts`
- `src/hooks/useOverviewExport.ts`
- `src/hooks/useProfitabilityPdfExport.ts`
- `src/pages/MenuItems.tsx`


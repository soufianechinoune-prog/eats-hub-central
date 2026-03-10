

## Animation de scan SIRET pour l'Éco-Contribution

Le bouton "Vérifier les SIRET" déclenche déjà un scan séquentiel (`checkMultiple`) mais sans retour visuel ligne par ligne. L'idée est de reproduire le pattern BODACC (scan laser row-by-row) adapté à ce contexte.

### 3 propositions

**Option A — Laser Scan (comme BODACC)**
Réutilise exactement le même pattern : une ligne lumineuse (border-bottom glow) qui balaye chaque ligne du tableau pendant le check, puis flash vert (inscrit) ou orange (non trouvé). Simple, cohérent avec le reste de l'app.

**Option B — Pulse Radar**
Chaque ligne scannée reçoit un effet de "pulse" circulaire partant du badge SIRET, comme un radar qui détecte. Un cercle concentrique s'étend depuis l'icône puis la ligne entière s'illumine brièvement en vert ou orange. Plus original.

**Option C — Matrix/Data Stream**
Un effet de "data stream" : pendant le scan, la ligne active a un dégradé animé gauche→droite (comme un chargement progressif), avec des micro-chiffres qui défilent dans la cellule du statut REP avant de se figer sur le résultat. Très tech/moderne.

### Implémentation (commune aux 3)

**`src/hooks/useEcoOrganismCheck.ts`** — Ajouter un callback `onScanningId` pour signaler quel restaurant est en cours de scan (comme `BodaccScanButton` fait déjà).

**`src/components/analytics/EcoContributionSection.tsx`** :
- Ajouter un état `scanningId` + `scanStatuses` + `flashId`
- Appliquer les classes CSS conditionnelles sur chaque `<TableRow>` du tableau
- Ajouter un `useEffect` pour le flash de transition (comme dans `Restaurants.tsx`)

**`src/index.css`** — Ajouter les keyframes spécifiques à l'option choisie (ou réutiliser les classes BODACC pour l'option A).

~50-80 lignes modifiées, 3 fichiers.


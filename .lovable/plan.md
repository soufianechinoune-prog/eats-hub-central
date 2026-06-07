## Pourquoi un mapping Splash ?

Aujourd'hui, le système Uber a déjà une interface de mapping (UUID Uber ↔ fiche restaurant) dans le panneau super-admin. Splash, lui, reçoit la data via API mais **sans rattachement** : ~24 caisses Splash flottent avec `restaurant_id = NULL` dans `splash360_restaurant_mapping` (dont O'Parinor, Belfort, Corbeil, Qwartz…). Résultat : la data tombe dans le vide, le badge Splash n'apparaît jamais, et personne ne sait quoi faire.

La logique est identique à Uber → il faut **la même interface pour Splash**.

## Ce que je propose de construire

### 1. Page « Mapping Splash360 » (super-admin)

Au même endroit que le mapping Uber, un nouvel onglet listant **toutes les caisses Splash reçues via l'API** :

```text
┌──────────────────────────────────────────────────────────────────┐
│ Splash ID │ Nom Splash             │ Restaurant rattaché  │ État │
├──────────────────────────────────────────────────────────────────┤
│ 1432      │ CHICKEN STREET OPARINOR│ [O'Parinor      ▼] │ ✅    │
│ 1455      │ CHICKEN STREET BELFORT │ [Belfort        ▼] │ ✅    │
│ 1501      │ CHICKEN STREET QWARTZ  │ [— à mapper —   ▼] │ ⚠️    │
│ 1620      │ TASTY CROUSTY TUNISIE  │ [Non applicable ▼] │ 🚫    │
└──────────────────────────────────────────────────────────────────┘
```

- **Dropdown** : recherche dans `restaurants` (scopé à la marque active).
- **« Non applicable »** : pour les caisses sans équivalent FR (Tunisie, Maroc, siège, showroom…) → on les sort de la file d'attente sans les supprimer.
- **Badge ⚠️** sur le nombre de caisses à mapper, visible dans la sidebar admin (même mécanique que les alertes BODACC).

### 2. Suggestion automatique (assistée, pas magique)

Pour chaque ligne non mappée, je calcule une **suggestion** en :
1. Normalisant le nom Splash (majuscules, sans accent, sans « CHICKEN STREET » / « TASTY CROUSTY »).
2. Cherchant un restaurant de la marque dont le nom contient ce token (`OPARINOR`, `BELFORT`…).
3. Si 1 seul match → suggestion pré-remplie dans le dropdown (avec un badge « Suggestion »).
4. Si 0 ou plusieurs → dropdown vide, à toi de choisir.

→ Tu valides en 1 clic au lieu de chercher.

### 3. Effet immédiat après mapping

Dès qu'une ligne passe à `restaurant_id` non-NULL :
- Le badge **Splash360** apparaît sur la fiche du resto.
- La data caisse déjà reçue par l'API (stockée en attente) est **rétroactivement rattachée**.
- La connexion devient « active » sur la page restaurant.

### 4. Règle d'affichage des badges (côté fiche resto)

Pour rester cohérent avec la logique « factuelle » :
- **Uber** : badge si `uber_store_id` rempli (peu importe `uber_opening_date`).
- **Deliveroo** : badge si `deliveroo_store_id` rempli.
- **Splash360** : badge si une ligne `splash360_restaurant_mapping` pointe vers ce resto.

## Détails techniques

- Nouvelle route super-admin : `/admin/integrations/splash-mapping`.
- Composant `SplashMappingTable.tsx` (copie/adaptation de `UberMappingTable`).
- Hook `useSplashUnmappedCount()` pour le badge sidebar.
- Endpoint d'update : `UPDATE splash360_restaurant_mapping SET restaurant_id = $1 WHERE splash_id = $2` (super-admin only).
- Backfill rétroactif : trigger SQL `AFTER UPDATE ON splash360_restaurant_mapping` qui rattache les éventuelles données en attente.
- Aucune modification de la logique d'ingestion API Splash existante.

## Ce que je ne fais PAS

- **Pas de matching 100 % auto** : tu valides chaque ligne (sécurité, comme pour Uber).
- **Pas de suppression** des caisses « Non applicable » : on les marque, elles disparaissent juste de la file.
- **Pas de changement** sur la connexion API Splash elle-même.

## Résultat attendu

- O'Parinor, Belfort, Corbeil, Qwartz, Goussainville, etc. → mappés en 5 minutes.
- Badge Splash360 visible sur chaque fiche concernée.
- Data caisse remonte automatiquement dès le prochain cycle API.
- Process clair et reproductible pour chaque nouvelle caisse Splash ajoutée.

Tu valides ce plan ?

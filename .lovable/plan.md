# Plan : Connexion Uber Eats multi-restaurants

## Objectif

Quand vous vous connectez avec votre compte Uber Manager (qui gère ~tout le réseau Chicken Street), exploiter **TOUS les stores** retournés par Uber au lieu d'un seul, et les associer en masse à vos restaurants CS.

---

## Architecture choisie

### Stockage du token (décision technique)

**Une seule ligne `uber_connections` "maître" + table de liaison.** Justification :
- Le token Uber est unique pour votre compte → pas de raison de le dupliquer 80 fois
- Quand le token se rafraîchit, **1 seule UPDATE** au lieu de N
- Les RLS et la lecture par restaurant restent simples via la table de liaison
- Évite les incohérences (token expiré sur certaines lignes, valide sur d'autres)

### Schéma DB (migration)

```text
uber_connections (déjà existante)
  ├─ id, access_token, refresh_token, expires_at, scopes
  ├─ restaurant_id  ← devient nullable (legacy) / null pour les nouvelles "master"
  ├─ + account_label TEXT       (ex: "Compte Soufiane - Manager CS")
  └─ + is_master BOOLEAN        (true = connexion globale multi-stores)

uber_connection_stores (NOUVELLE table)
  ├─ id UUID PK
  ├─ connection_id UUID → uber_connections(id) ON DELETE CASCADE
  ├─ restaurant_id UUID → restaurants(id) ON DELETE CASCADE
  ├─ uber_store_id TEXT NOT NULL
  ├─ store_name TEXT            (snapshot du nom Uber au moment du link)
  ├─ store_address TEXT
  ├─ activated_at TIMESTAMPTZ
  └─ UNIQUE (uber_store_id), UNIQUE (restaurant_id)
```

RLS : `chain_id` scoping via les restaurants liés + `is_super_admin()`.

---

## Flux utilisateur

```text
[Page resto] → "Connecter Uber Eats"
         ↓
   OAuth Uber (login.uber.com)
         ↓
   /auth/uber/callback
         ↓
   • Échange code → token
   • Insert uber_connections (is_master=true, restaurant_id=null)
   • fetchStores(token) → liste complète des N stores
         ↓
   Redirect → /uber-link-stores?connection={id}
         ↓
   ┌─────────────────────────────────────────────────────────────┐
   │  Associer vos restaurants Uber                              │
   │                                                              │
   │  Compte connecté : contact@opineo.io  •  82 stores trouvés  │
   │                                                              │
   │  ┌─────────────────────┬──────────────────────┬──────────┐ │
   │  │ Store Uber          │ Restaurant CS        │ Action   │ │
   │  ├─────────────────────┼──────────────────────┼──────────┤ │
   │  │ ✨ CS Argenteuil    │ Chicken Argenteuil ✓ │ [Lier]   │ │
   │  │ ✨ CS Boulogne      │ CS Boulogne ✓        │ [Lier]   │ │
   │  │ ⚠ CS Pantin Centre  │ [Sélecteur ▼]        │ [Lier]   │ │
   │  │ 🆕 CS Lyon Bellecour│ Aucun match          │ [Créer]  │ │
   │  │ 🆕 CS Marseille     │ Aucun match          │ [Créer]  │ │
   │  │ ❌ Autre Marque     │ —                    │ [Ignorer]│ │
   │  └─────────────────────┴──────────────────────┴──────────┘ │
   │                                                              │
   │  ☑ Tout sélectionner    [Confirmer 78 associations]         │
   └─────────────────────────────────────────────────────────────┘
         ↓
   Pour chaque ligne validée :
     • INSERT uber_connection_stores
     • UPDATE restaurants.uber_store_id
     • activateStoreIntegration(token, store_id)  (POS)
     • Si "Créer" : INSERT restaurants (chain actif) puis lier
         ↓
   Récap : "78 restaurants liés • 2 créés • 2 ignorés"
   → Redirect /uber-connections
```

---

## Auto-matching (votre choix)

Réutilise la logique éprouvée des imports CSV (mémoire `imports/resolution-identite-restaurants-v4`) :

1. **Normalisation** : `normalizeForAlias()` retire accents, "CS", "Chicken Street", ponctuation, espaces multiples
2. **Stratégies de match** par ordre de priorité :
   - Match exact sur nom normalisé
   - Match sur ville (extraite via regex après "CS" ou "Chicken Street")
   - Match flou (Levenshtein distance < 3) → marqué ⚠ "à vérifier"
3. **Affichage** :
   - ✨ Match auto fiable (préselectionné, prêt à valider)
   - ⚠ Match probable (préselectionné, mais badge orange)
   - 🆕 Aucun match → bouton "Créer ce restaurant"
   - ❌ Store hors marque active → "Ignorer" par défaut

---

## Création automatique de restaurants orphelins (votre choix)

Pour un store Uber sans match :
- Bouton **"Créer ce restaurant"** ouvre un mini-formulaire pré-rempli :
  - Nom : depuis Uber (ex: "CS Lyon Bellecour")
  - Adresse : depuis Uber (`store.location`)
  - `chain_id` : la marque actuellement active dans le sélecteur
  - `uber_store_id` : auto-rempli
  - Status : `actif`
- Validation → INSERT restaurant → INSERT uber_connection_stores en cascade

---

## Fichiers impactés

### Nouveaux
- `src/pages/UberLinkStores.tsx` — page de mapping
- `src/components/restaurants/UberStoreLinkRow.tsx` — ligne de tableau
- `src/services/uberLinkingService.ts` — `matchStoresToRestaurants()`, `linkStoreToRestaurant()`, `createRestaurantFromStore()`, `bulkLinkStores()`
- Migration SQL : table `uber_connection_stores` + colonnes `is_master`, `account_label` sur `uber_connections`

### Modifiés
- `src/pages/UberCallback.tsx` — au lieu d'activer le 1er store, créer une connexion master et rediriger vers `/uber-link-stores`
- `src/services/uberService.ts` — `getValidAccessToken(restaurantId)` lit désormais via `uber_connection_stores → uber_connections`
- `src/App.tsx` — route `/uber-link-stores`

### Inchangés
- `supabase/functions/uber-auth/index.ts` (OAuth déjà OK)
- `supabase/functions/uber-token/index.ts`

---

## Sécurité multi-tenant

- Les restaurants proposés dans le sélecteur passent par `useActiveRestaurants()` → seule la marque active (Chicken Street) est visible
- Les stores Uber appartenant à d'autres marques (cas rare si vous gérez plusieurs enseignes sur le même compte Uber) restent affichés mais non liables tant que vous n'êtes pas sur la bonne marque
- RLS sur `uber_connection_stores` : héritée du `chain_id` du restaurant lié

---

## Points d'attention

1. **Performance** : si Uber retourne 80+ stores, l'activation POS est faite en parallèle (Promise.all par batch de 10) avec retry sur échec individuel
2. **Idempotence** : si vous relancez la connexion, les stores déjà liés sont marqués "Déjà lié ✓" et non re-traités
3. **Rollback partiel** : si l'activation POS échoue pour 1 store, le lien DB reste mais un badge "⚠ POS non activé - réessayer" s'affiche

---

## Ce que vous pourrez tester après implémentation

- Cliquer "Connecter Uber Eats" depuis n'importe quelle page
- Voir la liste de TOUS vos restos Uber Manager
- Valider 80 associations en 1 clic
- Créer à la volée les restos qui n'existent pas encore dans CS
- Tous les restos liés héritent automatiquement du même token (refresh transparent)

## Plan révisé v2 (intègre smoke test + recos ingé)

### Étape 0 — Smoke test sur 1 UUID (NOUVEAU, bloquant)
Créer une edge function jetable `test-uber-report-single` qui :
1. Récupère un token via `client_credentials` avec scope `eats.report`.
2. Appelle `POST https://api.uber.com/v1/eats/report` avec `store_uuids: [<uuid>]` sur les 7 derniers jours.
3. Retourne la réponse Uber brute + un diagnostic clair (✅ / 401 / 403 / 404).

Test sur **`9508b676-c543-55cc-b5fa-5d0d6f5fe737`** (Chicken Street Besançon, dans la liste activée par Uber).

**Décision :**
- ✅ 200 + `workflow_id` → on continue les étapes 1-4.
- ❌ 4xx → STOP, on relance Sanjay avec la trace exacte avant tout.

### Étape 1 — Diff UUIDs (déjà fait ✅)
Fichier `Uber_Activation_Diff.xlsx` déjà généré. Récap : 0 manquant, 1 UUID inattendu côté CS (`b6d8deb4...` probablement Goussainville), 1 doublon dans liste Uber.

### Étape 2 — Migration BDD + flagging
1. Migration : `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS uber_pos_activated_at timestamptz;`
2. Si étape 0 ✅, INSERT-tool : `UPDATE restaurants SET uber_pos_activated_at = now() WHERE uber_store_id IN (<165 UUIDs activés>)`.
3. Vérification : `SELECT count(*) GROUP BY chain_id`.

### Étape 3 — Toggle UI sur `/uber-connections`
Badge par ligne dans la table de mapping :
- 🟢 "POS activé" si `uber_pos_activated_at IS NOT NULL`
- ⚪ "En attente POS" si UUID renseigné mais pas activé
- ➖ rien si pas de UUID

Modifs :
- `src/pages/UberConnections.tsx` (ou composant table mapping) : ajouter colonne badge
- Hook : étendre la requête pour ramener `uber_pos_activated_at`

### Étape 4 — Brouillon mail à Sanjay (avec validation avant envoi)
Inclure :
1. Confirmation reçue + tout matche.
2. Question UUID inattendu `b6d8deb4...` = Goussainville ?
3. Doublon `076ab060...` (info).
4. 3 TC sans UUID (Pavillons, Mulhouse, Nîmes) — à venir séparément.
5. **Question process futur (formulation ingé)** :
   > "What is the process for adding new stores in the future? Can we submit a batch request or is there a self-service option via the `eats.pos_provisioning` scope?"

Brouillon affiché dans le chat → tu valides → envoi par toi.

### Détails techniques
- Edge function : `supabase/functions/test-uber-report-single/index.ts`, GET ou POST avec `?store_uuid=...`. Réutilise les secrets `UBER_CLIENT_ID` / `UBER_CLIENT_SECRET` déjà présents.
- Migration : colonne `uber_pos_activated_at timestamptz NULL` sur `restaurants`. Pas de RLS à toucher (table déjà couverte).
- UI : pas de nouveau hook, juste enrichir la requête existante de la page `/uber-connections`.
- Edge function de test = jetable, à supprimer après validation finale.

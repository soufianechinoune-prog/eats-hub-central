# Collecteur automatique Deliveroo (phase 2) — Authentification & format

## Réponse directe aux 3 questions

Aujourd'hui la fonction `ingest-deliveroo-orders` n'a **pas encore** de clé d'ingestion partagée. Elle est déployée sans auth (`verify_jwt = false`) et attend un JSON contenant le CSV en base64/texte brut. Il faut donc ajouter une clé partagée avant de pouvoir l'appeler depuis un collecteur externe.

## Plan

1. **Sécuriser l'edge function `ingest-deliveroo-orders`**
   - Ajouter une vérification de clé partagée identique au pattern `ingest-uber-funnel`.
   - Lire `DELIVEROO_INGEST_KEY` depuis `Deno.env.get`.
   - Refuser les requêtes sans l'en-tête `x-api-key` correspondant.
   - Conserver `verify_jwt = false` (déjà le cas dans `config.toml`).

2. **Générer et stocker le secret**
   - Créer un secret `DELIVEROO_INGEST_KEY` via `generate_secret` (valeur aléatoire 64 caractères).
   - L'edge function le récupère automatiquement au prochain déploiement.

3. **Conserver le format d'entrée actuel**
   - Méthode : `POST`.
   - Corps JSON : `{ csvContent: string, fileName: string, dryRun?: boolean }`.
   - `csvContent` = contenu brut du CSV Deliveroo (séparateur virgule, guillemets doubles, encodage UTF-8).
   - En-tête obligatoire : `x-api-key: <DELIVEROO_INGEST_KEY>`.

4. **Documenter l'URL publique**
   - URL : `https://akcicojkrzeirffefdet.supabase.co/functions/v1/ingest-deliveroo-orders`.
   - Cette URL sera fournie au responsable/dev qui configure le collecteur externe.

5. **Valider le déploiement**
   - Déployer la fonction.
   - Tester un appel `POST` avec `dryRun: true` et la clé.
   - Vérifier qu'un appel sans clé retourne 401.

## Détails techniques

- Colonnes CSV attendues (insensibles à la casse) : `deliveroo_name`, `order_number`, `status`, `sent_at`, `delivered_at`, `subtotal`, `commission`, `commission_vat`, `net`.
- `sent_at` et `delivered_at` sont interprétés en heure de Paris puis convertis en UTC ISO.
- La clé sera visible uniquement dans le secret store ; je ne la communiquerai pas en clair dans le chat.

## Problème confirmé

Les logs Edge Function montrent : `CPU Time exceeded` après seulement 1 mois traité (avril, 5130 lignes).

Les fonctions edge Supabase ont une limite CPU stricte (~150s). Faire 24 mois × ~30 appels API Splash360 + upserts dans **un seul appel** dépasse largement cette limite, surtout pour Tasty Crousty (58 restaurants × 30 jours × 3 plateformes = ~5000 lignes/mois).

## Solution : orchestration côté client

Au lieu d'une boucle de 24 mois dans l'edge function, on lance **24 appels séparés** (un par mois) depuis le frontend. Chaque appel reste dans la limite CPU.

### Changements

**1. Edge Function `sync-splash360`**
- Garder le mode `sync` mais le rendre paramétrable : accepter `year` et `month` optionnels dans le body pour cibler un mois spécifique (au lieu du mois courant uniquement).
- Supprimer / désactiver le mode `backfill` interne (cause du timeout).

**2. Hook `useBackfillPOS` (`src/hooks/usePOSConnectors.ts`)**
- Réécrire pour faire une **boucle séquentielle côté client** : pour chaque mois des N derniers mois, appeler `sync-splash360` avec `{ mode: "sync", year, month }`.
- Renvoyer un callback de progression (`onProgress`) pour afficher l'état au fur et à mesure.
- Ajouter un petit délai (200ms) entre les appels pour ménager l'API Splash360.

**3. UI Backfill (`src/pages/Integrations.tsx`)**
- Afficher une barre de progression "Mois X/24 importé" pendant le backfill.
- Toast final récapitulatif (lignes totales, erreurs éventuelles).

### Résultat attendu

- Backfill Tasty Crousty : ~24 appels × ~30s = ~12 min, sans timeout.
- Données mensuelles disponibles de mai 2024 à avril 2026.
- L'utilisateur voit la progression en temps réel.

### Action après déploiement

Relancer "Backfill 24 mois" depuis la page Intégrations pour Tasty Crousty.

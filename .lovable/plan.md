
Contexte confirmé
- Tu ne vas pas perdre ta plateforme: la restauration d’une version remet surtout le code/UI, pas l’état des données backend déjà importées.
- J’ai vérifié que la table `restaurant_deliveroo_ids` existe en base et qu’elle contient bien:
  - `CHICKEN STREET - Nice 🌯`
  - `CHICKEN STREET - Nice Promenade 🌯`
  toutes deux liées à `Chicken Street - Nice`.
- Le problème persiste car le parser actif (`parse-deliveroo-statement`) utilise encore uniquement `restaurants.deliveroo_store_id` (single mapping), donc il ignore la table multi-mapping.
- Test dry-run exécuté: `CHICKEN STREET - Nice Promenade 🌯` ressort encore en `unmatchedNames`.

Pourquoi “restaurer” n’a pas corrigé
- La restauration a remis une ancienne version du code (parser/UI anciens).
- Le backend contient déjà le nouveau mapping multi-ID, mais le code restauré ne le lit pas.
- Donc tu vois “toujours pareil” même avec les données présentes.

Plan de correction (sans risque de perte)
1. Remettre le parser Deliveroo en multi-mapping
   - Lire `restaurant_deliveroo_ids` en priorité.
   - Résoudre `restaurant_id` via `deliveroo_store_name`.
   - Garder un fallback sur `restaurants.deliveroo_store_id` pour compatibilité.
   - Ajouter une normalisation légère des noms (tirets/espaces) pour éviter les faux non-matchs.

2. Remettre la page `DeliverooMatching` en multi-mapping
   - Afficher les correspondances existantes depuis `restaurant_deliveroo_ids`.
   - Sauvegarder une nouvelle ligne dans `restaurant_deliveroo_ids` (au lieu d’écraser `restaurants.deliveroo_store_id`).
   - Conserver le comportement “déjà lié” mais basé sur la table de mapping.

3. Vérifier le flux complet (avant import réel)
   - Dry-run avec un CSV “Nice Promenade” => plus d’unmatched.
   - Dry-run avec un CSV “Nice 🌯” => toujours correctement mappé.
   - Import réel sur un petit fichier pour confirmer l’écriture dans `deliveroo_orders.restaurant_id`.

4. Sécurisation / non-régression
   - Ne pas supprimer `deliveroo_store_id` tout de suite (compatibilité).
   - Ajouter un test fonctionnel minimal sur le parser pour les 2 alias d’un même restaurant.

Détails techniques
- Fichiers ciblés:
  - `supabase/functions/parse-deliveroo-statement/index.ts`
  - `src/pages/DeliverooMatching.tsx`
  - (optionnel) `src/lib/fuzzyMatch.ts` si on veut aligner “already linked” sur multi-mapping.
- Base de données:
  - Aucune migration destructive nécessaire maintenant (la table et la ligne “Nice Promenade” sont déjà présentes).
  - Pas de rollback des données requis.

## Contexte

Tu as raison — j'ai confondu les deux systèmes hier en faisant le switch vers Dishop :

- **Splash360** = caisse physique en magasin (in-store)
- **Dishop** = click & collect / vente en ligne propre

Ce sont deux flux totalement indépendants qui doivent **coexister**, pas se remplacer.

## État actuel en base (`chain_pos_connections`)

| Marque | Connecteur | Label | Actif | Dernière sync |
|---|---|---|---|---|
| Chicken Street | dishop | Dishop CS | ✅ true | jamais |
| Chicken Street | splash360 | Compte Chicken Street (migration) | ❌ false | 2026-05-18 |
| Chicken Street | splash360 | (sans label) | ❌ false | jamais |
| TASTY CROUSTY | splash360 | Splash Tasty Crusty | ✅ true | 2026-06-06 21:31 |

Les deux connexions Splash de Chicken Street ont été désactivées le 2026-06-07 à 10:27 (au moment où j'ai activé Dishop). C'est l'origine du « 0 data » sur la page Caisse de Chicken Street pour le 6 juin.

## Plan

### 1. Réactiver Splash360 pour Chicken Street
- Repasser `is_active = true` sur la connexion « Compte Chicken Street (migration) » (celle qui a un historique de sync au 18/05) — c'est la connexion réellement fonctionnelle.
- Laisser la 2e ligne Splash (sans label, jamais syncée) désactivée — c'est un doublon. On pourra la supprimer plus tard si tu confirmes.
- Garder la connexion Dishop active en parallèle.

### 2. Débloquer les syncs Splash360 en attente
- 17 runs cron consécutifs depuis 21:30 le 06/06 sont en état `running` figé (sans logs côté edge function).
- Marquer ces runs comme `failed` pour repartir propre.
- Déclencher manuellement un `sync-splash360` pour :
  - Vérifier que la fonction tourne toujours
  - Récupérer la data manquante depuis le 06/06 21:30 pour TASTY CROUSTY
  - Faire le premier sync de Chicken Street réactivé
- Si la fonction échoue silencieusement : lire les logs edge (`supabase--edge_function_logs`) et patcher.

### 3. UI page Caisse (séparation visuelle)
- Garder le statu quo : la page Caisse continue d'afficher les données Splash360 pour les deux marques.
- Dishop sera affiché séparément (page dédiée click & collect) une fois que Thomas aura activé le scope `export:read` côté Dishop.

## Détails techniques

- Aucune migration de schéma — uniquement des `UPDATE` sur `chain_pos_connections` et `splash360_sync_runs`.
- L'edge function `sync-splash360` reste inchangée si elle tourne. Sinon, patch ciblé après lecture des logs.
- Pas de modification de la connexion Dishop (elle attend la résolution du scope côté Thomas).

## À confirmer

Je réactive uniquement la ligne « Compte Chicken Street (migration) » (celle avec historique de sync) et je laisse le doublon désactivé — OK ?

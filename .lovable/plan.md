# Fermeture des accès publics — les 8 tables restantes

## Verdict : d'accord sur le fond, avec une réserve

J'ai vérifié chaque affirmation directement en base. Tout se confirme :

- **service_role a bien `bypassrls = true`** (vérifié). Et j'ai contrôlé les robots concernés (météo, UltraMsg, parsing des rapports Uber, rapports stats, promotions) : ils utilisent tous la clé service. Aucune collecte ne peut casser.
- **Les 2 bonnes surprises sont réelles.** `price_history` et `restaurant_deliveroo_ids` ont bien une règle « par enseigne » déjà en place, court-circuitée par une vieille règle ouverte. Supprimer la mauvaise suffit.
- **Les 6 autres tables** n'ont effectivement aucune règle correcte en dessous : `action_categories`, `csv_imports`, `import_guide_screenshots`, `promotions`, `report_templates`, `restaurant_name_aliases`, `weather_data` (soit 7 avec weather_data — le décompte « 6 » du message est légèrement optimiste, la liste du script est la bonne).

## La réserve : price_history risque de se bloquer tout seul

La bonne règle sur `price_history` filtre via `restaurant_action_id`. Or le code de l'app (`useMenuItemTracking`) insère des lignes avec `restaurant_action_id = null` quand aucune action n'est liée. Avec la règle par enseigne seule, ces lignes deviennent **impossibles à créer et à lire** pour tout utilisateur non super-admin.

La table est vide aujourd'hui (0 ligne), donc rien n'est perdu — mais l'historique des prix cesserait silencieusement de fonctionner dès la prochaine modification de tarif.

Correctif proposé, dans la même opération : rendre la règle tolérante aux lignes sans action liée, en la rattachant au menu_item plutôt qu'en bloquant sur un champ vide.

## Ce que je ferai

1. Appliquer le script fourni tel quel pour les 7 tables sans réserve (suppression des règles « tout le monde », remplacement par « utilisateurs connectés », et pour `restaurant_deliveroo_ids` simple suppression).
2. Pour `price_history` : supprimer les 4 règles ouvertes **et** remplacer la règle par enseigne par une version qui tolère `restaurant_action_id IS NULL`. D'accord avec toi sur `menu_items` : pas de colonne enseigne, donc aucun cloisonnement possible par ce biais — piste abandonnée.
3. Consigner dans la **même migration** les changements déjà passés en base hier, de façon idempotente (ils ne seront donc pas ré-appliqués deux fois) :
   - politiques `reports_authenticated_only`, `webhook_logs_authenticated_only`, `Chain scoped access on restaurants` (vérifiées présentes en base ce matin) ;
   - retrait du droit d'exécution des fonctions pour les visiteurs non connectés (vérifié : plus aucun droit `anon`/`public` sur les fonctions du schéma public).
4. Relancer la requête de vérification (attendu : 0 règle ouverte sans condition).

Note : le passage du dépôt GitHub en privé est une action à faire de ton côté, je ne peux pas la déclencher.

## Détails techniques

- Tout passe par une migration unique (les changements de règles ne peuvent pas être exécutés hors migration).
- Règle `price_history` révisée : `is_super_admin() OR restaurant_action_id IS NULL OR restaurant_action_id IN (...)` en lecture comme en écriture, filtrage par enseigne conservé quand l'action est renseignée.
- `weather_data` : la règle « Service role can manage weather data » est en réalité attribuée au rôle `public`, pas à service_role — sa suppression est donc bien un gain de sécurité, sans impact sur le robot météo.
- Rejeu de l'état d'hier écrit en `DROP POLICY IF EXISTS` + `CREATE POLICY` dans des blocs conditionnels, et `REVOKE ALL ON FUNCTION ... FROM anon, public` par boucle sur les fonctions du schéma public (117 aujourd'hui) — sûr même si déjà appliqué.


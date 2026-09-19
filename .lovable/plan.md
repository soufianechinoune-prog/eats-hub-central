# Enfiler le rattrapage complet de l'historique caisse Splash360

## Points du développeur — traités
- **File vide ≠ backfill terminé** : seuls les 11 jobs de la 1ère vague sont `completed`. La cadence 2 min / batch 4 est conservée jusqu'à la fin de l'historique complet.
- **Collision de caisse — vérifiée, aucun risque** : chaque restaurant actif a exactement **1 seul accès** (aucun doublon sur la clé restaurant+caisse, aucun restaurant à deux caisses enregistrées). Les identifiants de ticket Splash sont des UUID uniques globalement : même si une caisse supplémentaire existait sous le même accès, aucun ticket ne serait perdu (la station dans la clé est une sécurité, pas un facteur d'écrasement).

## État vérifié
- 180 accès Splash actifs (108 CS / 72 TC), stations : `default` (106), `Caisse 1` (71), `Caisse`/`CAISSE`/`CAISSE1` (3).
- Historique Splash (agrégats journaliers) : mai 2024 → aujourd'hui.
- Activité par restaurant : 102 restos depuis mai 2024, 70 depuis janvier 2025, 11 depuis février 2026.

## Périmètre de l'enfilage
- Fenêtre : **septembre 2026 → mai 2024**, récents d'abord, priorité basse (vague conservée).
- Anti-gaspillage : pas de job pour les mois antérieurs au premier mois d'activité connu de la caisse.
- Idempotent : clé unique (restaurant, station, année, mois) + `ON CONFLICT DO NOTHING` — les 11 jobs faits ne sont pas recréés.

## Volume attendu et rythme
- Total sans optimisation : 180 × 29 mois = 5 220 jobs. Avec saut des mois pré-activité : **≈ 4 500 jobs**.
- Débit nominal : 4 jobs / passage toutes les 2 min ≈ 120 jobs/h.
- **Rythme réel mesuré et communiqué** après l'enfilage : jobs terminés par heure (les mois vides et les petits volumes vont plus vite que les gros) → ETA recalé sur cette mesure, pas sur le nominal.

## Étapes
1. **Enfiler** : INSERT massif dans `splash_ticket_backfill_jobs` (caisse × mois, fenêtre Sept 2026 → mai 2024), récents d'abord.
2. **Confirmer le compte** : SELECT count(*) par statut juste après (attendu ~4 500, pas 11) — chiffre communiqué.
3. **Mesurer le rythme réel** : jobs terminés/h sur la première heure, ETA communiqué.
4. **Surveillance** : compteurs par statut + THROTTLE/erreurs 24 h ; rollback aux réglages prudents si 429/5xx.
5. **Fin** : retour du cron à 5 min uniquement quand la file complète est vidée.

## Détails techniques
- INSERT via requête SQL générée depuis `splash_restaurant_credentials` × fenêtre de mois, filtrée par premier mois d'activité (`splash360_daily_sales`).
- Aucune modification de schéma, du worker, des calculs ou des interfaces : seule la file est alimentée.

## Validation
- Compte des jobs enfilés communiqué et vérifiable (jobs par statut).
- Progression suivie par jobs terminés et tickets importés (compteurs avant/après).

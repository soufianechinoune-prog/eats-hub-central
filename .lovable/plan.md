# Enfiler le rattrapage complet de l'historique caisse Splash360

## Point sur la remarque du développeur — validée
- La file vide ne signifie pas backfill terminé : seuls les 11 jobs de la 1ère vague (Colombes, Belfort, Angers, Annecy, Reims, Amiens — août + septembre 2026) sont `completed`.
- Ne PAS repasser l'automate à 5 min : la cadence 2 min / batch 4 est conservée tant que l'historique complet n'est pas importé.
- L'enfilage complet de l'historique est la prochaine action.

## État vérifié
- 180 accès Splash actifs (108 CS / 72 TC), tous en `station: default`.
- Historique Splash existant (agrégats journaliers) : de mai 2024 à aujourd'hui.
- Activité par restaurant : 102 restos actifs depuis mai 2024, 70 depuis janvier 2025, 11 depuis février 2026.

## Périmètre de l'enfilage
- Fenêtre : **septembre 2026 → mai 2024** (on remonte jusqu'au plus ancien mois de données Splash, pas seulement juin 2024).
- Récents d'abord, en priorité basse (vague=1200 conservée).
- **Anti-gaspillage** : pour chaque caisse, on n'enfile pas les mois antérieurs à son premier mois d'activité connue (70 restos épargnés sur 7 mois, 11 restos sur 19 mois).
- Idempotent : clé unique (restaurant, station, année, mois) — les 11 jobs déjà faits ne sont pas recréés.

## Volume attendu
- Total sans optimisation : 180 × 29 mois = 5 220 jobs.
- Avec saut des mois pré-activité : **≈ 4 500 jobs** (5 220 − 814 économisés − 11 déjà terminés ≈ 4 505).
- Débit actuel : 4 jobs / passage toutes les 2 min ≈ 120 jobs/h → historique complet en **~1,5 à 2 jours** si aucun blocage.

## Étapes
1. **Enfiler** : INSERT massif dans `splash_ticket_backfill_jobs` (restaurant × mois), `priority` basse, récents d'abord, `ON CONFLICT DO NOTHING`.
2. **Confirmer le compte** : SELECT count(*) par statut juste après l'enfilage (doit afficher ~4 500, pas 11) — chiffre communiqué pour le suivi.
3. **Cadence conservée** : cron 2 min, batch 4, budget 55 s, verrou anti-doublon actif.
4. **Surveillance** : compteurs jobs par statut + occurrences THROTTLE/erreurs 24 h. Si 429/5xx apparaissent : rollback aux réglages prudents (batch 2, budget 40 s, pause 60 s) — la fréquence reste à 5 min seulement en dernier recours.
5. **Fin de rattrapage** : retour du cron à 5 min uniquement quand la file complète est vidée.

## Détails techniques
- INSERT via requête SQL (généré depuis `splash_restaurant_credentials` × fenêtre de mois, filtré par premier mois d'activité depuis `splash360_daily_sales`).
- Aucune modification de schéma, du worker, des calculs ou des interfaces : seule la file est alimentée.

## Validation
- Le compte des jobs enfilés est communiqué et vérifiable à tout moment (jobs par statut).
- Progression suivie par jobs terminés et tickets importés (compteurs avant/après).

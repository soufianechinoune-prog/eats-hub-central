# Rattrapage de la data Dishop (sync stoppée depuis le 20/07/2026)

## Réponse à la question

**Oui, il faut renouveler les credentials auprès de Dishop, même pour la data ancienne.**

- L'API Dishop exige un token OAuth valide à CHAQUE appel, y compris pour exporter des semaines passées. Sans nouveau `client_id` / `client_secret`, aucune donnée (ancienne ou nouvelle) n'est accessible — c'est exactement l'erreur 403 « Invalid client credentials » vue depuis le 27/07.
- Bonne nouvelle : l'endpoint utilisé (`export-weekly-data/accounting-report`) permet de demander n'importe quelle semaine passée. La data ancienne n'est PAS perdue chez Dishop — elle est juste inaccessible tant que le compte API est invalide. Dès que les credentials sont régénérés, on peut tout rattraper.

## Plan d'action

1. **Côté utilisateur** : demander à Dishop (support ou console) la régénération du couple `client_id` / `client_secret` pour le compte Chicken Street (`zmedrf_zme2093z_sdfvzer_zevr` actuellement rejeté).
2. **Stockage sécurisé** : enregistrer les nouvelles valeurs via le formulaire de secrets (jamais en clair dans le code).
3. **Rattrapage** : relancer la sync hebdomadaire pour chaque semaine manquante (du 20/07/2026 à aujourd'hui, ~6 semaines). L'import est idempotent — pas de risque de doublon.
4. **Vérification** : contrôler que le CA Dishop sur la vue d'ensemble remonte au niveau attendu (~33 k€/semaine, ~145 k€/mois comme en juin) et que le badge « Données au … » disparaît de la tuile Dishop.

## Détails techniques

- Secrets concernés : `DISHOP_CLIENT_ID` / `DISHOP_CLIENT_SECRET` (noms exacts confirmés au moment du stockage).
- La fonction de sync télécharge un ZIP hebdomadaire (commandes, facturation, clients) et l'ingère dans `dishop_orders` / `dishop_order_items` / `dishop_customers`.
- Le cron du lundi 05:00 UTC reprendra ensuite automatiquement le flux courant.

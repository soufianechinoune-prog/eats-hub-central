# API comptable Uber : pourquoi elle semble « ne plus fonctionner »

## Diagnostic (vérifié à l'instant)

La clé `cs_7953...905a` est **valide et active** (chaîne TASTY CROUSTY) : l'appel renvoie bien HTTP 200.

Le vrai problème est ailleurs : **les données s'arrêtent à la semaine du 29 juin 2026**.

- `?list=1`, `?from/to` et l'appel sans paramètre lisent la liste des semaines dans la table `weekly_reports`.
- Cette table n'a plus reçu de nouvelle semaine depuis le **8 juillet 2026** : la tâche planifiée `weekly-uber-report` (lundi 06:00) est **désactivée** — elle a été mise en pause en même temps que l'arrêt des envois WhatsApp.
- Les dernières exécutions pour l'autre marque étaient par ailleurs en statut `error`.

En revanche, les **données Uber sont bien à jour** : en forçant une semaine récente (`?weekStart=2026-08-17`), l'API renvoie des chiffres complets et corrects. Donc seul le « catalogue des semaines » est figé.

## Correctifs proposés

1. **Découpler l'API de la table `weekly_reports`**
   Faire dériver la liste des semaines depuis les données de commandes réelles (calendrier des lundis couverts par les commandes Uber de la marque) plutôt que depuis les lignes de rapport. L'API ne peut alors plus se figer si une tâche planifiée est en pause.

2. **Réactiver la génération hebdomadaire**
   Réactiver uniquement la tâche de génération (`weekly-uber-report`, lundi 06:00 UTC), **sans** réactiver l'envoi WhatsApp (`weekly-uber-report-whatsapp` reste en pause, conformément au kill-switch en place).

3. **Rattraper les semaines manquantes**
   Générer les rapports pour les semaines du 6 juillet 2026 jusqu'à la dernière semaine complète, pour les deux marques, et vérifier la cause des statuts `error` côté Chicken Street.

4. **Vérification finale**
   Rappeler l'API avec la clé du comptable en `list=1` et confirmer que la dernière semaine disponible correspond bien à la dernière semaine clôturée.

## Détails techniques

- Fonction concernée : `supabase/functions/weekly-uber-api/index.ts` (branches `list=1`, `from/to`, défaut).
- Nouvelle source des semaines : requête d'agrégation sur les commandes Uber de la chaîne (`date_trunc('week', ... AT TIME ZONE 'Europe/Paris')`), exposée via une RPC `SECURITY DEFINER` pour rester performante.
- Le champ `status`/`updatedAt` restera renvoyé quand une ligne `weekly_reports` existe, sinon `status: "live"`.
- Aucun changement dans les 7 champs financiers renvoyés : contrat d'API inchangé, aucun calcul ajouté.
- Cron : réactivation de `cron.job` id 20 seulement.

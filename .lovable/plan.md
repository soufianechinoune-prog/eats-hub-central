
Diagnostic rapide (pourquoi tu as 0 import)
- La colonne `success_scores.score_month` est de type `DATE` (format attendu `YYYY-MM-DD`).
- Le formulaire envoie `2026-03` (format `type="month"`), donc PostgreSQL rejette chaque upsert (`22007 invalid input syntax for type date`).
- C’est cohérent avec tes captures: 101 lignes associées en preview, puis 0 importées / 101 erreurs.

Plan d’implémentation
1) Normaliser le mois avant écriture DB
- Ajouter une conversion unique: `YYYY-MM` → `YYYY-MM-01`.
- Valider le format (regex) avant import/sauvegarde, sinon afficher une erreur claire.

2) Corriger l’import CSV (`SuccessScoreCsvImport.tsx`)
- Convertir `scoreMonth` en date SQL normalisée avant la boucle d’upsert.
- Utiliser cette date normalisée dans `score_month`.
- Améliorer le feedback:
  - Toast succès seulement si `failed === 0`.
  - Toast warning/erreur si partiel ou total échec.
  - Afficher 2-3 messages d’erreur concrets (pas juste le compteur).

3) Corriger la saisie manuelle (`ManualEntryDialog.tsx`)
- Même conversion `YYYY-MM` → `YYYY-MM-01` pour:
  - lecture existante (`.eq("score_month", ...)`)
  - upsert.
- Garder l’UI en `type="month"` (ergonomie inchangée), mais conversion côté logique.

4) Fiabiliser les comparaisons et la cohérence
- Ne pas changer le schéma DB (pas de migration nécessaire).
- Conserver la contrainte `UNIQUE(restaurant_id, score_month)` pour que réimporter un mois mette à jour proprement.

Détails techniques (section dev)
- Fichiers impactés:
  - `src/components/success-score/SuccessScoreCsvImport.tsx`
  - `src/components/success-score/ManualEntryDialog.tsx`
- Petite fonction utilitaire à introduire (locale au composant ou helper partagé):
  - `toScoreMonthDate(month: string) => string | null`
  - ex: `"2026-03" -> "2026-03-01"`
- Ajustement UX:
  - état final d’import avec style “warning” si `failed > 0` (éviter icône succès verte quand tout a échoué).

Validation après implémentation
- Rejouer ton CSV `quality_scores_complet_2026-03-12.csv` avec mois `2026-03`.
- Résultat attendu: imports > 0, plus d’erreur `invalid input syntax for type date`.
- Vérifier que la page “Score de Réussite” se met à jour sur le mois de mars.
- Tester aussi une saisie manuelle sur le même mois pour confirmer que l’upsert fonctionne.

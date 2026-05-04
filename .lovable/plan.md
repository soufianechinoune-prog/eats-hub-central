## Objectif

Faire passer le row `reports` de `pending` à `completed` automatiquement quand Uber notifie le webhook, et déclencher le parsing CSV `parse-payment-report`.

## Diagnostic confirmé

- ✅ Webhook Uber **est appelé** et signature HMAC validée (`webhook_logs` contient 1 entrée à 06:06:29).
- ❌ Le webhook n'a pas trouvé le row `reports` correspondant car **Uber renvoie un `job_id` au format `<workflow_root>_<job_suffix>`** différent du `workflow_id` stocké au POST.
- ❌ Le fallback "créer un nouveau row" a planté silencieusement : `restaurant_id` est `NOT NULL` mais le webhook ne le connaît pas → insert refusé sans log.

## Changements

### 1. `supabase/functions/uber-report-webhook/index.ts`
- Matcher le report sur le **préfixe partagé** : `workflow_id LIKE '<workflow_root>%'` (en plus de eq `job_id` et eq `workflow_id`).
- Logger explicitement l'erreur d'`update` ET d'`insert` (actuellement silencieux pour insert).
- Supprimer le fallback "créer un nouveau row sans restaurant_id" (impossible) → loguer un warning à la place.
- Logger le résultat du match (`Matched report: <id>` ou `none`).

### 2. Relancer un test end-to-end
- Appeler `test-uber-report-single` sur Chicken Street Besançon (`9508b676-c543-55cc-b5fa-5d0d6f5fe737`) dates derniers 7 jours.
- Polling DB : surveiller `reports.status` → `completed`, puis `payments_*` tables peuplées par `parse-payment-report`.

### 3. Cleanup
- Supprimer manuellement le row `pending` orphelin (`82b1be35-...`) pour repartir propre.

## Détails techniques

```text
Uber POST /v1/eats/report  →  returns workflow_id = "ROOT_A"
                               stored as reports.workflow_id

Uber Webhook eats.report.success  →  body.job_id = "ROOT_B"
                                      (même ROOT, suffixe différent)

Match actuel : workflow_id = ROOT_B  ❌ no match
Match fixé  : workflow_id LIKE ROOT% ✅ match
```

## Validation

Critère de succès : après relance du test, dans les 5-10 min :
1. `webhook_logs` contient un nouvel event
2. `reports.status = 'completed'` avec `sections` non-null et `completed_at` rempli
3. Logs `parse-payment-report` montrent succès du parsing CSV
4. Tables `payments_*` contiennent de nouvelles lignes pour Chicken Street Besançon

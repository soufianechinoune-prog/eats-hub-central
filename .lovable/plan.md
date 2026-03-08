

## Désactiver le cron `process-scheduled-messages`

Le cron job `process-scheduled-whatsapp-messages` est actif et tourne toutes les minutes. Il faut le supprimer de `cron.job`.

### Action

Exécuter une seule commande SQL :

```sql
SELECT cron.unschedule('process-scheduled-whatsapp-messages');
```

Cela supprime le job. Aucun code ne change. La fonction edge reste disponible si tu veux la réactiver plus tard manuellement ou avec un nouveau cron à fréquence réduite.


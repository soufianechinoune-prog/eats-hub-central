## Diagnostic

Les messages que tu reçois ne viennent PAS d'un cron. Ils sont générés en temps réel par le **chatbot IA** dans `ultramsg-webhook` : à chaque message WhatsApp entrant sur notre numéro UltraMsg, la fonction appelle l'IA puis répond automatiquement via `sendWhatsAppReply` (fetch vers `api.ultramsg.com/.../messages/chat`).

Vérifié dans `message_history` : 9 envois sortants ce matin entre 09:26 et 09:46 UTC, tous vers `+33699564000`, tous des réponses IA — pas d'envoi programmé (`scheduled_messages` pending = 0).

Deux crons WhatsApp existent aussi (`weekly-uber-report-whatsapp` jeudi 07:00, et le rapport hebdo `weekly-uber-report` lundi 06:00) — pas responsables de ce que tu reçois, mais on les met en pause par sécurité tant que tu réutilises le numéro ailleurs.

## Plan : kill-switch global outbound WhatsApp

Une seule variable d'environnement `WHATSAPP_OUTBOUND_DISABLED` qui, quand elle vaut `true`, court-circuite tout envoi sortant vers UltraMsg. Aucune donnée perdue, réactivation instantanée en changeant la valeur.

### 1. Secret

Créer le secret `WHATSAPP_OUTBOUND_DISABLED = "true"` (via `set_secret`).

### 2. Court-circuit dans chaque fonction qui appelle `api.ultramsg.com/.../messages/*`

Ajouter en tête de la logique d'envoi :
```ts
if (Deno.env.get('WHATSAPP_OUTBOUND_DISABLED') === 'true') {
  console.log('[kill-switch] Outbound WhatsApp disabled, skipping send');
  return /* success sentinel adapté à la fonction */;
}
```

Fonctions à patcher :
- `supabase/functions/ultramsg-webhook/index.ts` → dans `sendWhatsAppReply` (ligne 1102) : c'est celle qui envoie les réponses IA en boucle
- `supabase/functions/send-whatsapp/index.ts`
- `supabase/functions/send-whatsapp-media/index.ts`
- `supabase/functions/send-weekly-report-whatsapp/index.ts`
- `supabase/functions/process-scheduled-messages/index.ts`
- `supabase/functions/notify-tablet-pause/index.ts`

Le webhook `ultramsg-webhook` continue de recevoir et logger les messages entrants (utile pour l'historique), il ne fait juste plus de réponse sortante.

### 3. Désactiver les 2 crons WhatsApp

```sql
UPDATE cron.job SET active = false
WHERE jobname IN ('weekly-uber-report-whatsapp', 'weekly-uber-report');
```

(`weekly-uber-report` ne fait que générer le ZIP mais on l'arrête aussi pour être sûr qu'aucun envoi automatique ne parte.)

### 4. Vérification

- Envoyer un message WhatsApp au numéro UltraMsg → vérifier dans les logs `ultramsg-webhook` qu'on lit bien `[kill-switch] Outbound WhatsApp disabled`
- Vérifier que `message_history` n'a plus d'insertion sortante après le déploiement

## Réactivation plus tard

Changer le secret à `"false"` (ou le supprimer) + réactiver les 2 crons via `UPDATE cron.job SET active = true`. Aucun redéploiement de code nécessaire.

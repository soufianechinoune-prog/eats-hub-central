## Décision

On abandonne la configuration de `notify.cs-delivery-performance.com` chez Hostinger (blocage technique : pas de NS sur sous-domaine). Les emails d'authentification continueront via les templates Lovable par défaut (fonctionnels, non brandés). Tout le transactionnel opérationnel passera par **WhatsApp** (déjà intégré via UltraMsg) et des **notifications in-app**.

---

## Plan d'action

### 1. Nettoyer la config email inutile
- Vérifier qu'aucune Edge Function ne dépend d'un envoi email transactionnel Lovable actif (scan des call sites `send-transactional-email`, `auth-email-hook` custom).
- Si présents et non utilisés : ne rien supprimer (safe), juste documenter qu'ils sont inertes.
- **Ne pas** appeler `toggle_project_emails` (les emails auth par défaut doivent continuer de partir : reset password, confirmation compte).

### 2. Centre de notifications in-app (nouveau)
Créer un système de notifications persistantes accessible depuis la topbar :
- **Table `notifications`** (Supabase) : `id`, `user_id`, `chain_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at` + RLS scoped user_id + GRANT.
- **Hook `useNotifications`** : fetch + Realtime subscription pour push live.
- **Composant `NotificationBell`** dans `AppLayout` topbar : badge count non-lues, popover liste, mark-as-read, deep-link vers la page concernée.
- **Toasts + son** : réutiliser `useMessageNotifications` existant pour signaler l'arrivée.

Événements notifiables (déclenchés côté Edge Functions existantes) :
- Nouvel avis client < 3 étoiles
- Taux d'erreur commande > seuil sur 24h
- Restaurant offline (downtime détecté)
- Import CSV terminé / échoué
- Nouvelle alerte BODACC

### 3. Renforcer WhatsApp pour l'opérationnel externe
Pour les notifications qui doivent atteindre franchisés/managers hors app :
- **Templates WhatsApp additionnels** dans `MessageTemplateEditor` :
  - Alerte note faible (rating < 3)
  - Rappel hebdo performance
  - Notification remboursement contesté
- **Automatisation optionnelle** via cron Edge Function : envoi auto selon règles configurables (page `/settings/notifications` à créer).
- Vérifier robustesse : `WhatsAppStatusCard` déjà en place détecte les déconnexions UltraMsg.

### 4. Google Auth (déjà actif)
- Confirmer que Google OAuth est proposé sur `/login` pour réduire les besoins de reset password (qui dépendrait des emails).
- Si non, l'activer (1 setting + bouton UI).

### 5. Communication utilisateur
Ajouter une note discrète dans `/settings/integrations` expliquant :
- "Les emails transactionnels sont désactivés. Les alertes passent par WhatsApp et le centre de notifications."
- Lien vers la page de préférences notifications.

---

## Détails techniques

**Schéma table `notifications` :**
```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain_id uuid REFERENCES public.chains(id) ON DELETE CASCADE,
  type text NOT NULL,          -- 'review_low', 'error_rate', 'downtime', 'import', 'bodacc'
  severity text DEFAULT 'info', -- 'info', 'warning', 'critical'
  title text NOT NULL,
  body text,
  link text,                    -- route in-app
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users mark own as read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
```

**Realtime :** activer publication sur `notifications` pour push live.

**Fichiers principaux créés/modifiés :**
- `supabase/migrations/xxxx_notifications.sql` (nouveau)
- `src/hooks/useNotifications.ts` (nouveau)
- `src/components/layout/NotificationBell.tsx` (nouveau)
- `src/components/layout/AppLayout.tsx` (ajout bell dans topbar)
- `src/pages/NotificationPreferences.tsx` (nouveau, optionnel phase 2)
- Edge Functions existantes (reviews sync, downtime, import) : ajouter `INSERT` dans `notifications` sur événements critiques.

---

## Périmètre livraison

**Phase 1 (ce plan)** : Centre de notifications in-app + Bell topbar + 2-3 événements branchés (avis faible, import terminé).

**Phase 2 (à confirmer plus tard)** : Templates WhatsApp additionnels + cron d'alertes automatiques + page préférences.

Confirmez si vous voulez la Phase 1 seule d'abord, ou Phase 1+2 d'un coup.

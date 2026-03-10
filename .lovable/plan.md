

## Plan : Remplacer Realtime par Polling pour réduire les coûts

### Problème
- `useUnreadMessages` utilise un canal Realtime Supabase monté dans la sidebar globale (toutes les pages)
- Connexion permanente 24/7 même sans activité = consommation continue de crédits Cloud
- 3 autres canaux Realtime dans la messagerie (actifs uniquement sur /messaging)

### Solution

**1. `useUnreadMessages.ts` — Remplacer Realtime par polling 60s**
- Supprimer le `.channel()` et `.subscribe()`
- Ajouter un `setInterval` de 60 secondes pour re-fetch le count
- Le polling ne consomme qu'au moment de la requête (négligeable)

**2. `Messaging.tsx`, `OutboundMessages.tsx`, `ConversationView.tsx` — Remplacer par polling 30s**
- Ces 3 composants ne sont montés que sur /messaging
- Remplacer chaque canal Realtime par un polling toutes les 30 secondes (rafraîchissement plus fréquent car l'utilisateur est activement sur la page)
- Nettoyage du `setInterval` au unmount

### Impact
- Zero canal Realtime = zero coût Realtime permanent
- Polling 60s sur la sidebar = ~1440 requêtes/jour (négligeable en coût DB)
- Polling 30s sur /messaging = actif uniquement quand la page est ouverte

### Fichiers modifiés
- `src/hooks/useUnreadMessages.ts`
- `src/pages/Messaging.tsx`
- `src/components/messaging/OutboundMessages.tsx`
- `src/components/messaging/ConversationView.tsx`


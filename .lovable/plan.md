
Objectif
- Faire en sorte que “Envoyé avec succès” corresponde à une vraie délivrabilité WhatsApp, et éviter les cas où l’API répond “sent: true” alors que rien n’apparaît sur le téléphone expéditeur (0033767818586) ni chez le destinataire (0699564000).

Constat (à partir des traces)
- Le navigateur envoie bien des requêtes POST vers la fonction backend “send-whatsapp” et reçoit des réponses 200 avec { success: true, sent: 1, failed: 0 }.
- Les logs backend indiquent “Message sent successfully …”.
- Malgré ça, tu ne vois pas le message “en cours d’envoi”/sortant sur le téléphone expéditeur, et tu ne reçois rien sur 0699.
=> Cela pointe très fortement vers un problème de session/connexion côté outil d’envoi WhatsApp (statut “instance” déconnecté, takeover, session expirée, etc.), car l’API peut accepter la demande mais ne pas pouvoir la relayer au réseau WhatsApp.

Problème supplémentaire détecté (important)
- Un des numéros destinataires est mal formé dans les données: exemple “+330 76 21 16 20 5”.
- Le code actuel de send-whatsapp enlève juste les espaces puis:
  - si ça commence par “0” => préfixe “33”
  - si ça commence par “+” => enlève “+”
- Résultat: “+330…” devient “330…” (incorrect). Pour la France, on veut “33” + numéro sans le 0, donc “+33 06…” -> “336…”, mais “+3306…” doit être corrigé en “336…”.
=> Même si ce n’est pas la cause principale de ton 0699, c’est une source réelle de non-réception pour certains restaurants et il faut la corriger.

Ce que je vais implémenter (backend + UI) une fois approuvé

1) Ajouter un contrôle de “connexion WhatsApp” avant tout envoi
- Créer une nouvelle fonction backend “whatsapp-status” (ou équivalent) qui appelle l’endpoint UltraMsg:
  - GET https://api.ultramsg.com/{INSTANCE_ID}/instance/status?token=...
  - GET https://api.ultramsg.com/{INSTANCE_ID}/instance/me?token=... (optionnel, pour afficher le numéro connecté)
- La fonction renverra un JSON simple: { connected: boolean, status: string, me?: { number, name }, raw?: ... }.

2) Bloquer l’envoi si l’instance n’est pas connectée
- Modifier la fonction backend “send-whatsapp”:
  - Avant la boucle d’envoi, appeler instance/status.
  - Si pas “connected”, retourner une erreur claire (HTTP 503) du type:
    - “Le téléphone d’envoi WhatsApp est déconnecté. Reconnecte la session (QR) puis réessaie.”
  - Ça évite le faux positif “sent: true” côté app quand l’instance est en réalité offline/KO.

3) Corriger la normalisation des numéros (fiabiliser les envois)
- Remplacer la logique actuelle par une fonction robuste (FR + général):
  - Nettoyage: retirer espaces, tirets, parenthèses, points.
  - Gérer les préfixes:
    - “00” => convertir en “+”
    - “+33” suivi de “0” => supprimer le “0” (ex: +3306… => +336…)
    - “0XXXXXXXXX” => +33XXXXXXXXX
    - Si déjà “33XXXXXXXXX” (sans +) => ok
  - Sortie au format attendu par l’API (sans “+” si nécessaire).
- Ajouter une validation minimale:
  - si après formatage le numéro est manifestement trop court/long, marquer le destinataire en “failed” immédiatement avec une erreur “numéro invalide” (et ne pas appeler l’API).

4) Ajouter un “Diagnostic” dans /messaging pour rendre le problème visible immédiatement
Dans l’UI (Messaging > Envoyer et/ou Rapports):
- Un petit encart “Statut WhatsApp” avec un bouton:
  - “Vérifier la connexion”
  - Affiche: Connecté / Déconnecté, et si possible le numéro WhatsApp actuellement connecté côté outil d’envoi.
- Un bouton “Envoyer un message test” (ex: vers 0699564000) qui:
  - Appelle d’abord whatsapp-status, puis send-whatsapp si connecté.
  - Affiche un résultat clair + conserve le détail (id message côté provider, erreur si non connecté, etc.).

5) (Optionnel mais recommandé) Améliorer la preuve de livraison
- On a déjà un webhook côté backend (ultramsg-webhook) pour les ACK (delivered/read).
- Je vérifierai que:
  - Les événements “ack” mettent bien à jour message_history (statuts delivered/read).
  - L’UI “Envoyés” affiche bien ces statuts.
- Si les ACK n’arrivent jamais, on ajoutera un polling léger via l’endpoint UltraMsg “messages” filtré par ID (sans spammer, juste pour diagnostics).

Séquence de test après implémentation
1. Dans /messaging, cliquer “Vérifier la connexion”.
   - Si “Déconnecté”: la UI explique quoi faire (reconnecter la session WhatsApp de l’outil).
2. Cliquer “Envoyer un message test” vers 0699564000.
3. Vérifier:
   - Le message apparaît sur le téléphone expéditeur (0033767818586).
   - Le message arrive sur 0699564000.
   - Dans l’historique, le statut passe de “sent” à “delivered/read” si l’ACK est actif.

Risques / limites (transparents)
- Si l’outil d’envoi WhatsApp est déconnecté côté fournisseur (session expirée / takeover), l’app ne peut pas “réparer” ça toute seule: elle doit le détecter et te guider, puis bloquer l’envoi tant que ce n’est pas reconnecté.
- La normalisation des numéros corrigera des cas comme “+330 …”, mais il faudra aussi nettoyer les numéros stockés dans les fiches restaurants à terme (on pourra ajouter un nettoyage automatique lors de l’édition).

Fichiers concernés (technique)
- Backend:
  - supabase/functions/send-whatsapp/index.ts (amélioration: status check + normalisation + validation)
  - Nouvelle fonction: supabase/functions/whatsapp-status/index.ts (statut instance/me)
- Frontend:
  - src/components/messaging/UnifiedSendView.tsx (encart statut + test)
  - src/components/messaging/WeeklyReports.tsx (optionnel: statut avant envoi)
  - (éventuellement) src/components/messaging/ConversationView.tsx (même logique de blocage/diagnostic)

Résultat attendu
- Si tu relances 4 rapports et que l’instance est déconnectée: tu verras immédiatement “Déconnecté” + l’envoi sera bloqué (pas de faux “envoyé”).
- Si l’instance est connectée: l’envoi doit réapparaître sur le téléphone expéditeur et arriver sur 0699564000.
- Les numéros mal formatés (ex: +330…) ne partiront plus silencieusement vers un mauvais destinataire.

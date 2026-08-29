# Brouillon du mail à Sanjay (Uber)

**Objet :** [Urgent] Provisioning API Reports — 30 stores manquants + 3 ré-activations (CS / TC)

**À :** Sanjay

---

Hello Sanjay,

On a un blocage côté import des rapports de versement Uber Eats (`PAYMENT_DETAILS_REPORT`) pour plusieurs restaurants des enseignes Chicken Street et Tasty Crousty.

**Diagnostic :** ces stores ne sont pas rattachés à l’application "CS Delivery Performance" (ou l’accès a été perdu), ce qui génère des erreurs `user_not_allowed` côté Reports API. Résultat : on ne peut plus récupérer les versements juin–juillet–août 2026 pour ces restaurants.

J’ai besoin de ton aide sur 2 actions :

## 1. Provisioning initial — 30 stores jamais rattachés

**Chicken Street (4 stores) :**
- `789d109a-c071-57a8-bc7f-f277237727eb`
- `7b9d739d-a71b-59ac-ab41-a48806496af6` (Belfort)
- `92211a3b-35d7-4472-b1a1-66ddf9b0f7cf` (Goussainville)
- `502c3fd5-0b51-5489-8ef5-81e4a96c7097` (Porte de Montreuil)

**Tasty Crousty (26 stores) :**
- `59b94706-37df-51c7-9ed6-f37769c66929`
- `ffa12c99-0c43-5b89-bb51-42994b62d8df`
- `86e73a3c-6863-5937-931a-ff07c2d33abe`
- `c7ba2490-9f0c-58e7-9230-12e76ed96fe2`
- `37b27fc0-bb7e-5c2e-abd0-48dd5471d2c4`
- *(liste complète des 26 UUIDs Tasty Crousty à insérer ici — certains ont été tronqués dans le fil de conversation)*

## 2. Ré-activation d’accès — 3 stores actifs dé-provisionnés

Ces restaurants ont du volume mais ont perdu l’accès API début juillet 2026 :

- **Tasty Crousty — Chevilly-La-Rue** : `cebb2eaa-ae21-5389-8edb-cea4cd74c8c6`
- **Tasty Crousty — Aulnay** : *(UUID à confirmer / compléter)*
- **Tasty Crousty — Dijon** : `cdea72e9-0dcd-47b3-beec-533036579016`

## Objectif

Pouvoir à nouveau générer les `PAYMENT_DETAILS_REPORT` pour juin, juillet et août 2026 sur l’ensemble de ces restaurants.

Merci d’avance pour ton aide.

Bonne journée,
[Prénom]

---

## Notes / points à compléter avant envoi

1. **Liste des 26 UUIDs Tasty Crousty** : certains UUIDs étaient tronqués dans le contexte. Il faut les coller en entier dans la section "Tasty Crousty (26 stores)".
2. **UUID Aulnay** : à vérifier / compléter dans la section ré-activation.
3. **Signature** : remplacer `[Prénom]` par l’expéditeur.

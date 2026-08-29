# Brouillon du mail à Sanjay (Uber)

**Objet :** [Urgent] Provisioning API Reports — 30 stores manquants + 2 ré-activations (CS / TC)

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
- `d3651911-52d1-594c-96d0-74fbf27952e0`
- `e934d80c-6863-5573-af49-bc14a0a99265`
- `aec01e5b-f381-5594-b3ec-215d91f3ba29`
- `37cfc2b9-13df-558a-b957-578ef607e9f6`
- `486584b8-a99d-5a73-be89-f4cb50cd28bb`
- `af603dc7-70eb-5608-81ee-1a0731bf2059`
- `c249b1b7-452d-57b1-8f12-bcd85351f8bf`
- `09e0905e-499a-5cc0-9d74-88f79d2f0f1a`
- `9ccdd573-4c84-5b98-a692-be4b7eca6b7d`
- `133006e2-f76d-5da7-8c6e-23ed5a55bfa9`
- `c3eee44c-0a67-5bda-9020-df3fdf328371`
- `5fa84887-82e2-559e-bc1a-fee1f6f49a82`
- `c8efedd1-f688-5c76-a458-466cd50f25d9`
- `5ca89644-ff62-5a23-8a17-8952cc292376`
- `d44c3f96-9845-551d-8fd9-95d0b3594db0`
- `92fdf32e-23a7-5450-8bd7-183c7ee616c6`
- `c7acca67-b8bb-55c8-8f7d-165dbb91e7eb`
- `1cd9708a-bcbd-4e43-91e2-eb1d30575b76`
- `71fe3e8c-9928-418a-8980-9f9cdb9011af`
- `61c8a914-bde0-4ab9-ac69-3eb1d0e65b3b`
- `cdea72e9-0dcd-47b3-beec-533036579016` (Dijon)

## 2. Ré-activation d’accès — 2 stores actifs dé-provisionnés

Ces restaurants ont du volume mais ont perdu l’accès API début juillet 2026 :

- **Tasty Crousty — Chevilly-La-Rue** : `cebb2eaa-ae21-5389-8edb-cea4cd74c8c6`
- **Tasty Crousty — Aulnay** : `ed0e86b6-728d-59d1-b1ab-541bffec49d9`

## Objectif

Pouvoir à nouveau générer les `PAYMENT_DETAILS_REPORT` pour juin, juillet et août 2026 sur l’ensemble de ces restaurants.

Merci d’avance pour ton aide.

Bonne journée,
[Prénom]

---

## Notes avant envoi

1. **Signature** : remplacer `[Prénom]` par l’expéditeur.
2. **Dijon** : présent dans la liste des 26 stores Tasty Crousty car son UUID n’était pas rapproché côté CS Delivery ; il s’agit probablement aussi d’un accès perdu.

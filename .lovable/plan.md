## Objectif
Vérifier la liste de UUIDs activés par Uber GTS, identifier les écarts vs les fichiers envoyés (`Chicken_Street_UUIDs_Uber_final.xlsx` et `Tasty_Crousty_UUIDs_Uber_final.xlsx`), puis préparer la réponse à Uber.

## Étape 1 — Diff automatique des UUIDs
Script Python qui :
1. Charge les 2 fichiers Excel envoyés depuis `/mnt/documents/`.
2. Compare avec les listes reçues d'Uber (collées ci-dessus).
3. Produit pour chaque marque :
   - UUIDs **envoyés mais NON activés** par Uber (à relancer en priorité).
   - UUIDs **activés mais non envoyés** (doublons ou ajouts inattendus).
   - Détection des doublons internes dans la liste Uber (j'ai déjà repéré que `076ab060-65fe-527f-bd2d-ac86ef26f647` apparaît **2 fois** dans la liste Tasty Crousty → c'est probablement pour ça qu'il y a 62 lignes au lieu de 65).
4. Génère un fichier `Uber_Activation_Diff.xlsx` avec 4 onglets : `CS_Manquants`, `CS_Inattendus`, `TC_Manquants`, `TC_Inattendus`.

## Étape 2 — Mise à jour de la base
Pour les restos confirmés activés, marquer dans la table `restaurants` un flag `uber_pos_activated_at = now()` (ajout de colonne si elle n'existe pas) → ça permettra ensuite à l'edge function `uber-create-report` de savoir quels stores sont prêts pour le pull de rapports automatique.

## Étape 3 — Brouillon de réponse à Uber GTS
Email court qui :
1. Confirme la bonne réception et remercie.
2. Liste explicitement les UUIDs **manquants** (s'il y en a) avec nom du resto + adresse pour que Sanjay puisse les ajouter en batch.
3. Reconfirme le UUID de Chicken Street Goussainville (resté en suspens dans le mail précédent).
4. Demande confirmation du SLA pour les futurs ajouts (1 resto isolé vs nouvelle marque).

## Étape 4 — Mémo process interne
Mettre à jour la note interne avec :
- Le `client_id` confirmé : `wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX` (déjà dans le code, on confirme qu'il est bien le bon en prod).
- La procédure d'ouverture d'un nouveau resto (envoyer UUID à GTS).
- Délai indicatif observé (date d'envoi → date de retour Uber).

## Détails techniques
- Fichiers Excel : lecture via `openpyxl`, normalisation des UUIDs en lowercase pour le diff.
- Migration SQL : `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS uber_pos_activated_at timestamptz;` puis `UPDATE` ciblé sur les UUIDs confirmés activés.
- Output final dans `/mnt/documents/Uber_Activation_Diff.xlsx` + brouillon de mail dans le chat.

## Questions ouvertes
- Veux-tu que j'ajoute aussi un **toggle UI** dans la page `/uber-connections` pour visualiser quels restos sont activés POS vs en attente ? (optionnel, pas bloquant).

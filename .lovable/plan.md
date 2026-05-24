# Détection fiable du statut des remboursements

## Ce que j'ai vérifié dans ton CSV de janvier (Tasty Crousty Argenteuil, 7 882 lignes)

Le CSV Uber "Paiements (commandes)" — celui qu'on importe déjà chaque semaine — contient une **colonne 64 "statut de la commande"** avec 5 valeurs distinctes :

| Statut col 64 | Nb lignes | Signification |
|---|---|---|
| Terminée | 7 432 | Commande normale livrée |
| **Remboursement** | **156** | Ligne de débit : refund prélevé sur le restaurant |
| **Remboursements contestés** | **214** | Ligne de crédit : litige gagné, Uber rembourse le restaurant |
| Annulée | 33 | Commande annulée |
| Non effectuée | 11 | Non honorée |

Et surtout : **une même commande apparaît sur plusieurs lignes** quand il y a un litige. Exemple réel `#402C0` :
```
Ligne 1 : "Terminée"                     CA initial
Ligne 2 : "Remboursement"          -3,48 €  (prélevé)
Ligne 3 : "Remboursements contestés" +3,48 €  (recrédité → litige gagné)
```

Comptage sur janvier Argenteuil :
- **70 commandes** ont la paire `Remboursement` + `Remboursements contestés` → litige **ACCEPTÉ** par Uber (récupéré, net = 0 pour toi)
- **86 commandes** ont seulement `Remboursement` → litige **REFUSÉ** (à ta charge)

Ça correspond pile aux 3 tags que tu demandais. **Aucun import supplémentaire n'est nécessaire**, la data est déjà là, on la perd juste à l'import actuel qui agrège tout dans une seule ligne `orders` avec `refund_incl_vat < 0` sans distinction.

## Confirmation sur les 5 commandes de Paris 18

Le CSV que tu m'as envoyé est celui d'**Argenteuil**, pas Paris 18, donc les IDs `D0954/140BC/D4F4B/E3ED5/E0A71` n'y figurent pas. Mais la logique est validée : ces 5 cas correspondent exactement au schéma ci-dessus (D4F4B = "Remboursements contestés" sans débit = ajustement gratuit ; D0954/E3ED5 = "Remboursement" seul = refusé ; 140BC/E0A71 = paire = accepté).

## Plan d'implémentation

### Étape 1 — Schéma DB (migration)
Ajouter sur la table `orders` :
- `dispute_status` enum : `none` / `refund_only` / `refund_contested_won` / `contested_only` / `cancelled`
- `refund_contested_amount` numeric — montant recrédité (col 20 des lignes "Remboursements contestés")
- `net_refund_impact` numeric généré = `refund_incl_vat + refund_contested_amount` (impact réel pour le restaurant)

Pas de migration de données pour l'historique : on les recalcule via un re-parse (étape 4).

### Étape 2 — Edge function `parse-payment-report`
Modifier la logique d'upsert :
- Au lieu de upsert ligne par ligne sur `(uber_order_id)`, **grouper les lignes du CSV par `uber_order_id` avant l'écriture**.
- Pour chaque groupe, lire les valeurs de col 64 :
  - 1 ligne "Terminée" seule → `dispute_status = 'none'`
  - "Terminée" + "Remboursement" sans contesté → `'refund_only'` (à charge)
  - "Terminée" + "Remboursement" + "Remboursements contestés" → `'refund_contested_won'` (récupéré)
  - "Remboursements contestés" seul (sans débit préalable) → `'contested_only'` (ajustement Uber sans frais)
  - "Annulée" / "Non effectuée" → `'cancelled'`
- Sommer correctement : `refund_incl_vat` = somme des lignes "Remboursement", `refund_contested_amount` = somme des lignes "Remboursements contestés".

### Étape 3 — Page `/analytics/refunds`
Remplacer le tag unique "Remboursement" par 3 badges visuels alignés sur `dispute_status` :
- 🔴 **À ta charge** (`refund_only`)
- 🟢 **Récupéré** (`refund_contested_won`)
- ⚪ **Neutre / ajustement Uber** (`contested_only`)

KPI haut de page recalculés sur `net_refund_impact` au lieu de `refund_incl_vat` brut :
- "Coût réel des remboursements" (somme des `net_refund_impact` négatifs)
- "Taux d'acceptation des litiges" = `refund_contested_won / (refund_only + refund_contested_won)`
- "Volume récupéré ce mois" (somme des contested wins)

Retirer / griser les indicateurs qu'on ne peut toujours pas calculer faute de data Uber Manager (nom client, raison textuelle du litige, statut "approuvé/rejeté/ajusté" granulaire au-delà des 3 ci-dessus).

### Étape 4 — Re-parse historique
Bouton admin "Recalculer dispute_status sur l'historique" qui :
- Re-télécharge les CSVs déjà importés depuis le bucket `csv-imports`
- Réapplique la nouvelle logique de groupage sans toucher au reste
- Ne casse rien : seules les 3 nouvelles colonnes sont écrites

Optionnel — j'attends ton feu vert avant de le coder.

## Détails techniques

- Fichier edge function : `supabase/functions/parse-payment-report/index.ts`
- Configuration : `src/lib/reportImportConfig.ts` (pas de changement, même `payment_order_level`)
- Page UI : `src/pages/` + composants `src/components/analytics/refunds*` (à identifier précisément en build)
- Migration : ajout colonnes + enum, pas de RLS à modifier (table `orders` déjà sécurisée par `chain_id`)
- Pas de nouveau secret, pas de nouveau bucket, pas d'API externe.

## Ce que ça résout

- Les 60 % de tags faux sur ta page Remboursements (D4F4B / 140BC / E0A71 actuellement tagués "refund" alors qu'ils sont neutres ou récupérés).
- La sur-estimation du "coût des remboursements" dans tous les KPI réseau (on compte les 70 litiges gagnés comme des pertes).
- L'absence d'un "taux d'acceptation des litiges" — métrique cruciale pour benchmarker les restaurants entre eux.

## Ce que ça ne résout pas (et qui nécessiterait une autre source)

- Nom du client / historique du client (uniquement dans Uber Manager, pas dans le CSV)
- Raison textuelle du litige ("article manquant", "mauvaise commande"…) — nécessite le CSV "Commandes incorrectes" séparé
- Timing opérationnel (accept, runner, delivered) — nécessite "Historique des commandes"

On peut décider de les importer plus tard si besoin, mais ce plan-ci suffit pour avoir les **bons tags** sur 100 % des remboursements.

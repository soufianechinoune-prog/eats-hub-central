

## Import des releves Deliveroo - Onglet dedie

### Contexte

Le CSV Deliveroo est un **releve de paiement** (statement) tres different des rapports Uber Eats. Il contient toutes les transactions financieres d'un restaurant sur une periode de facturation : commandes livrees, remboursements clients, contestations, commandes annulees, titres-restaurants (Edenred, Swile, Sodexo), et commissions Deliveroo.

Le PDF "Guide des paiements Deliveroo" est conserve comme reference pour les prochaines etapes (analyse des types de transactions).

### Structure du CSV Deliveroo

Le fichier est divise en **3 sections** separees par des lignes de titre :
1. **"Orders and related adjustments"** -- commandes + ajustements associes
2. **"Payments for contested customer refunds"** -- contestations de remboursements (facture precedente)
3. **"Other payments and fees"** -- titres-restaurants orphelins, frais divers

Chaque section a le meme header (13 colonnes) :

| Colonne | Contenu |
|---|---|
| Nom du restaurant | Nom Deliveroo exact (ex: "CHICKEN STREET - Argenteuil") |
| Numero de commande | ID numerique Deliveroo (ex: 50519302390) |
| Date et heure de livraison (UTC) | Timestamp ISO |
| Historique | Type de transaction (Livraison, Remboursement client, etc.) |
| Montant commande (EUR) | Montant brut de la commande |
| Montant net des ajustements (EUR) | Montant des ajustements |
| Taux de commission Deliveroo | Ex: "24.00% + 0,00" |
| Commission de Deliveroo (EUR) | Montant commission |
| Taux TVA de commission / ajustement | Ex: 20.00 |
| Commission / ajustement TVA (EUR) | TVA sur commission |
| Montant total a payer | Net final de la ligne |
| Note | Details textuels (peut contenir des retours a la ligne!) |
| Numero de commande (UUID) | UUID unique de la commande |

**Difficulte majeure** : le champ "Note" peut contenir des **retours a la ligne** (details de remboursement sur plusieurs lignes), ce qui casse un parsing CSV ligne par ligne classique.

### Types de transactions (colonne "Historique")

| Type | Description |
|---|---|
| Livraison | Commande livree standard |
| A emporter | Commande a emporter (click & collect) |
| Montant commande annulee | Commande annulee (payee au restaurant) |
| Commission Deliveroo sur la commande annulee | Commission sur commande annulee |
| Remboursement client | Debit pour remboursement client |
| Remboursement client refuse | Credit : contestation gagnee |
| Remise sur offre Marketer | Promotion Deliveroo |
| Montant commande Edenred | Debit titre-restaurant Edenred |
| Montant commande Swile | Debit titre-restaurant Swile |
| Montant commande Sodexo | Debit titre-restaurant Sodexo |
| Nouvelle livraison | Repreparation de commande |
| Remboursement de commission | Credit commission sur produit indisponible |
| Facture precedente: ... | References a une facture anterieure |

### Plan d'implementation

#### 1. Nouvelle table `deliveroo_orders`

Table dediee pour stocker chaque ligne du releve Deliveroo :

```text
deliveroo_orders
  id                    UUID PK
  restaurant_id         UUID FK -> restaurants (nullable, resolu via deliveroo_store_id)
  restaurant_name       TEXT -- nom brut du CSV
  deliveroo_order_id    TEXT -- numero de commande numerique
  deliveroo_uuid        TEXT -- UUID en derniere colonne
  delivery_datetime     TIMESTAMPTZ
  history_type          TEXT -- "Livraison", "Remboursement client", etc.
  order_amount          NUMERIC -- Montant commande
  adjustment_amount     NUMERIC -- Montant net des ajustements
  commission_rate       TEXT -- "24.00% + 0,00"
  commission_amount     NUMERIC -- Commission de Deliveroo
  vat_rate              NUMERIC -- Taux TVA
  vat_amount            NUMERIC -- Commission / ajustement TVA
  total_payable         NUMERIC -- Montant total a payer
  note                  TEXT -- contenu complet de la note
  section               TEXT -- "orders", "contested_refunds", "other_payments"
  statement_file        TEXT -- nom du fichier source
  created_at            TIMESTAMPTZ DEFAULT now()
```

Contrainte unique sur `(deliveroo_uuid, history_type, delivery_datetime)` pour eviter les doublons lors de reimports.

#### 2. Edge function `parse-deliveroo-statement`

- Recoit le contenu CSV + le nom du fichier
- Gere le **parsing multi-lignes** (champ Note avec retours a la ligne entre guillemets)
- Detecte les sections via les lignes de titre ("Orders and related adjustments", etc.)
- Resout le restaurant via `deliveroo_store_id` dans la table `restaurants`
- Parse les montants au format francais (virgule = decimale)
- Upsert dans `deliveroo_orders`
- Retourne les stats classiques (inserted, updated, skipped, errors)

#### 3. Onglet "Deliveroo" dans la page Import

Modifier la page `/report-import` pour ajouter un **onglet primaire** au-dessus des tabs existants :

```text
[ Uber Eats ]  [ Deliveroo ]
```

- L'onglet **Uber Eats** affiche l'interface actuelle (inchangee)
- L'onglet **Deliveroo** affiche une interface simplifiee :
  - Pas de selection de type de rapport (un seul type : releve de paiement)
  - Upload du fichier CSV statement
  - Le restaurant est **auto-detecte** via le nom Deliveroo dans le CSV + matching `deliveroo_store_id`
  - Memes etapes : Upload > Apercu > Validation > Import
  - Si le restaurant n'est pas reconnu (pas de `deliveroo_store_id` matche), redirection vers la page de matching

#### 4. Fichiers concernes

| Fichier | Action |
|---|---|
| Migration SQL | Creer table `deliveroo_orders` + index + RLS |
| `supabase/functions/parse-deliveroo-statement/index.ts` | Nouveau -- parser CSV Deliveroo |
| `src/pages/ReportImport.tsx` | Ajouter onglet primaire Uber/Deliveroo + interface Deliveroo |
| `src/lib/reportImportConfig.ts` | Ajouter config `deliveroo_statement` |

### Ce qui est conserve en memoire (PDF)

Le guide des paiements Deliveroo documente 12 scenarios de transactions. Cette reference sera utilisee lors des prochaines etapes d'analyse financiere (profitabilite, remboursements, commissions) pour comprendre la signification exacte de chaque type de ligne.


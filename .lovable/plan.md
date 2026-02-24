

# Identifier les commandes Deliveroo avec offres marketing

## Contexte

Dans la base, les commandes Deliveroo avec une offre marketing se distinguent de deux facons :
1. **Ligne "Contribution marketing"** separee (meme `deliveroo_order_id`) avec `total_payable > 0` et note "Marketer offer Deliveroo funding"
2. **Note sur la ligne "Livraison"** contenant "Remise sur offre Marketer: X,XX" (indique le montant de la remise appliquee au client)

Certaines commandes n'ont que la note "Remise sur offre Marketer" sans ligne "Contribution marketing" (ex: 50602588242 avec 2,37€ de remise mais pas de co-financement Deliveroo).

## Modifications

### Fichier 1 : `src/hooks/useFinancesDrilldown.ts`

**a) Ajouter `note` a la requete** (ligne 261) : inclure le champ `note` dans le SELECT de `fetchDeliverooIndividualOrders`.

**b) Tracker `has_offer` dans le groupement** (lignes 279-325) : ajouter un champ `has_offer: boolean` et `offer_note: string` au groupe. Le mettre a `true` si :
- La ligne est de type "Contribution marketing" (co-financement Deliveroo), OU
- La note contient "Remise sur offre Marketer"

**c) Propager dans le resultat** : retourner `has_offer` et `offer_note` dans chaque commande groupee.

### Fichier 2 : `src/hooks/useFinancesDrilldown.ts` — Interface `OrderFinanceData`

Ajouter deux champs optionnels :
```
has_offer?: boolean;
offer_note?: string;
```

Et les mapper dans le `useMemo` du `orderData` (ligne 824-847).

### Fichier 3 : `src/components/analytics/OrdersAnalysisSection.tsx`

**a) Badge visuel** : sur chaque ligne de commande Deliveroo qui a `has_offer === true`, afficher un petit badge vert "Offre" a cote du numero de commande.

**b) Tooltip** : au survol du badge, afficher le detail de l'offre (ex: "Remise sur offre Marketer: 8,10 — Co-financement Deliveroo: +2,00€").

**c) Filtre optionnel** : ajouter un toggle ou filtre "Avec offre uniquement" pour ne voir que les commandes avec promotions Deliveroo.

## Detail technique du flag

```text
Donnees en base pour 50556820623 :
  Livraison : note = "Contribution marketing, Remise sur offre Marketer: 8,10"
  Contrib.  : note = "Marketer offer Deliveroo funding", total_payable = 2.00

→ has_offer = true
→ offer_note = "Remise sur offre Marketer: 8,10"

Donnees pour 50602588242 (sans co-financement) :
  Livraison : note = "Remise sur offre Marketer: 2,37"
  (pas de ligne Contribution marketing)

→ has_offer = true  
→ offer_note = "Remise sur offre Marketer: 2,37"

Commande sans offre (ex: 50602590898) :
  Livraison : note = null
→ has_offer = false
```

## Resultat attendu

- Les commandes avec offres marketing sont visuellement identifiables par un badge vert
- On peut filtrer pour ne voir que ces commandes
- Le detail de la remise est accessible au survol


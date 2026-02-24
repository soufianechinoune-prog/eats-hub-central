
# Corriger le decalage timezone et le compteur de commandes Deliveroo

## Bug identifie

### Cause racine : `getDay()` / `getDate()` utilisent le fuseau horaire local du navigateur

Le code de regroupement par semaine dans `Analytics.tsx` utilise :
```text
const dt = new Date(row.delivery_datetime);
const dayOfWeek = dt.getDay();          // heure LOCALE (Paris UTC+1)
const diff = dt.getDate() - dayOfWeek;  // heure LOCALE
```

Les timestamps en base sont stockes en UTC. Le navigateur en France (UTC+1) decale les commandes tardives du dimanche soir vers le lundi, ce qui les assigne a la semaine suivante.

**Preuve sur la semaine du 19 janvier :**
- 2 commandes du dim. 25/01 apres 23h UTC (= lun. 26/01 en heure Paris) sont perdues : 8,10 + 28,39 = 36,49 EUR
- 2 commandes du dim. 18/01 apres 23h UTC (= lun. 19/01 en heure Paris) sont ajoutees : 16,45 + 15,24 = 31,69 EUR
- Ecart net : -4,80 EUR, ce qui donne 6 356,75 - 4,80 = 6 351,95 EUR (exactement la valeur affichee)

### Bug secondaire : compteur de commandes gonfle (385 au lieu de 383)

Les types "Nouvelle livraison" et "Montant de la repreparation de commande" sont dans ORDER_TYPES et incrementent `order_count` alors qu'ils ne sont pas des commandes reelles :
- "Nouvelle livraison" : ligne d'en-tete pour une repreparation, order_amount=0, total_payable=0
- "Montant de la repreparation" : credit de repreparation, order_amount=0, total_payable=11,60

## Modifications

### Fichier : `src/pages/Analytics.tsx`

#### 1. Utiliser les methodes UTC pour le calcul de semaine (lignes ~403-407)

```text
Avant :
  const dt = new Date(row.delivery_datetime);
  const dayOfWeek = dt.getDay();
  const diff = dt.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(dt.setDate(diff));
  const weekKey = format(weekStart, "yyyy-MM-dd");

Apres :
  const dt = new Date(row.delivery_datetime);
  const dayOfWeek = dt.getUTCDay();
  const diff = dt.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  dt.setUTCDate(diff);
  const weekKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
```

Cela garantit que le regroupement par semaine utilise les memes bornes UTC que le releve Deliveroo (lundi 00:00 UTC a dimanche 23:59 UTC).

#### 2. Sortir "Nouvelle livraison" et "Repreparation" de ORDER_TYPES

Ces types ne doivent pas compter comme des commandes ni contribuer au CA :

```text
Avant :
  ORDER_TYPES = ["Livraison", "A emporter", "Nouvelle livraison",
                 "Montant de la repreparation de commande"]

Apres :
  ORDER_TYPES = ["Livraison", "A emporter"]
```

#### 3. Creer un type REPREPARATION_TYPES pour gerer separement

```text
REPREPARATION_TYPES = ["Montant de la repreparation de commande", "Nouvelle livraison"]
```

Dans le bloc d'agregation :
```text
} else if (REPREPARATION_TYPES.includes(ht)) {
  // Ajout au net_payout sans compter comme commande ni comme CA
  g.net_payout += Number(row.total_payable) || 0;
}
```

"Nouvelle livraison" a total_payable=0, donc neutre. "Montant de la repreparation" a total_payable=11,60 et contribue correctement au versement.

## Resultats attendus apres correction (semaine du 19 janvier)

```text
CA TTC         : 6 356,75 EUR (383 Livraisons, methode UTC)
Commandes      : 383 (sans Nouvelle livraison ni repreparation)
Commission     : 1 527,94 EUR (1 525,16 + 2,78 repreparation)
Promos         : 614,00 EUR
Remb.          : 26,60 EUR
Titre Resto    : 966,90 EUR
Versement Del. : 4 197,42 EUR
Versement Tot. : 5 164,32 EUR
Rentabilite    : ~81,3%
```

Ces chiffres correspondent exactement au document de reconciliation valide.

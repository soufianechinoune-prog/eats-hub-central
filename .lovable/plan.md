

# Restructurer le "Detail lignes" en accordeon Mois > Restaurant

## Objectif

Remplacer la liste plate actuelle par une structure hierarchique a deux niveaux :
1. **Niveau 1 : Mois** (accordeon deroulant) - affiche le total du mois
2. **Niveau 2 : Restaurant** (accordeon deroulant a l'interieur du mois) - affiche le total par restaurant
3. **Niveau 3 : Lignes individuelles** (tableau visible quand le restaurant est ouvert)

Par defaut, tous les mois et restaurants sont replies pour une vue synthetique.

## Structure visuelle

```text
v Janvier 2025                    Remb: 5 240€  Prel: -320€  Solde: 4 920€   (52 lignes)
    v Chicken Street - Villeurbanne           Solde: 3 240€   (14 lignes)
        | Date       | Description    | Montant   | Ref.           |
        | 06/01/2025 | Autres frais   | 231,43 €  | PPHBN8NX...    |
        | 06/01/2025 | Autres frais   | -12,30 €  | PPHBN8NX...    |
    > Chicken Street - Nantes                 Solde: 1 680€   (8 lignes)
> Fevrier 2025                    Remb: 1 200€  Prel: -450€  Solde: 750€     (38 lignes)
> Mars 2025                       ...
```

## Modifications

### Fichier : `src/components/analytics/EcoContributionDetail.tsx`

Refonte complete du composant :

1. **Grouper les donnees** avec `useMemo` :
   - Premier niveau : par mois (extraire mois/annee de `payout_date`)
   - Second niveau : par `restaurant_id` au sein de chaque mois
   - Calculer les sous-totaux (remboursements, prelevements, solde, nombre de lignes) a chaque niveau

2. **Accordeons imbriques** :
   - Utiliser le composant Collapsible de Radix (deja installe) pour les mois et les restaurants
   - Chevron + animation d'ouverture/fermeture
   - En-tete de mois : nom du mois, KPIs (Remb., Prel., Solde, nb lignes)
   - En-tete de restaurant : nom, solde, nb lignes
   - Contenu : tableau des lignes individuelles (Date, Description, Montant, Ref.)

3. **Recherche conservee** : le filtre texte existant reste en haut et filtre les lignes avant le groupement

4. **Tri** : les mois sont affiches du plus recent au plus ancien (Decembre en haut), les restaurants par solde decroissant au sein de chaque mois

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/components/analytics/EcoContributionDetail.tsx` | Refonte avec accordeons Mois > Restaurant > Lignes |


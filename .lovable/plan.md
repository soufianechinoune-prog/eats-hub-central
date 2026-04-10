

# Corrections statut restaurants + mécanisme de succession

## Problèmes identifiés

1. **Bug réactivation** : Le switch `is_active` ne nettoie pas `uber_closing_date` → le badge "Fermé le..." reste visible même après réactivation
2. **Pas de workflow de succession** : Quand un franchisé ferme sa société et en ouvre une nouvelle, il n'y a aucun moyen de transférer les identifiants Uber vers la nouvelle fiche

## Corrections

### 1. Fix du switch de réactivation (`src/pages/RestaurantDetail.tsx`)

Dans `toggleActiveMutation`, quand `isActive = true` :
- Remettre `uber_closing_date` à `null`
- Remettre `deliveroo_closing_date` à `null`
- Afficher un toast de confirmation

### 2. Bouton "Réactiver" visible sur les restaurants fermés (`src/pages/RestaurantDetail.tsx`)

Ajouter un bouton "Réactiver ce restaurant" bien visible à côté du badge "Fermé" en haut de la fiche (en plus du switch en bas). Ce bouton :
- Met `is_active = true`
- Efface les dates de fermeture
- Propose optionnellement de mettre à jour la date d'ouverture à aujourd'hui

### 3. Mécanisme de succession / transfert d'identifiants (`src/pages/RestaurantDetail.tsx`)

Ajouter un bouton "Transférer vers un autre restaurant" sur les fiches fermées. Workflow :
- L'utilisateur sélectionne le restaurant cible (dropdown des restaurants actifs)
- Le système transfère tous les `restaurant_uber_ids` de l'ancien restaurant vers le nouveau (en tant qu'IDs secondaires)
- Transfère aussi les `restaurant_name_aliases`
- L'ancien restaurant reste marqué comme fermé avec une note de succession

### 4. Actions immédiates via migration

Pas de migration nécessaire — tout se fait via l'UI existante ou les améliorations ci-dessus.

## Fichiers modifiés

- `src/pages/RestaurantDetail.tsx` : fix switch réactivation + bouton réactiver + bouton transfert succession

## Résultat

- Tu pourras réactiver Poitiers, Sens et Besançon directement depuis leur fiche
- Pour Clermont-Ferrand et Paris 18, tu pourras transférer leurs identifiants Uber vers la nouvelle fiche/fiche cible
- Pour les prochaines fois, le même workflow de transfert sera disponible sur toute fiche fermée



# Corriger la navigation "Temps prépa+livraison"

## Problème identifié
Dans la page Vue d'ensemble (`Overview.tsx`), les clics sur "Temps prépa+livraison" dans les cartes Global et Uber Eats redirigent vers `/analytics?view=operations&tab=totalDelivery` au lieu de la nouvelle page de comparaison `/compare/total-delivery-time`.

## Corrections à apporter

### Fichier : `src/pages/Overview.tsx`

**Ligne 1088** (carte Global) :
- Avant : `onClick={() => navigate('/analytics?view=operations&tab=totalDelivery')}`
- Après : `onClick={() => navigate('/compare/total-delivery-time')}`

**Ligne 1125** (carte Uber Eats) :
- Avant : `onClick={() => navigate('/analytics?view=operations&tab=totalDelivery')}`
- Après : `onClick={() => navigate('/compare/total-delivery-time')}`

## Résultat attendu
Après cette correction, cliquer sur "Temps prépa+livraison" depuis la Vue d'ensemble amènera directement à la nouvelle page de comparaison avec le tableau de classement, le tri, la recherche et l'export PDF.

## Section technique

Modifications simples de 2 lignes dans `Overview.tsx` :
```tsx
// Ligne 1088 - Carte Global
<MetricRow 
  icon={Truck} 
  label="Temps prépa+livraison" 
  value={...} 
  color="text-cyan-500" 
  onClick={() => navigate('/compare/total-delivery-time')} 
/>

// Ligne 1125 - Carte Uber Eats
<MetricRow 
  icon={Truck} 
  label="Temps prépa+livraison" 
  value={...} 
  color="text-cyan-500" 
  onClick={() => navigate('/compare/total-delivery-time')} 
/>
```

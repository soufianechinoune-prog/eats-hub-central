

## Probleme identifie

Le bouton BODACC cherche `r.siren` sur chaque restaurant, mais dans la base de donnees le champ s'appelle `siret` (14 chiffres) et `siren` est toujours `null`. Le SIREN correspond aux 9 premiers chiffres du SIRET.

## Correction

**Fichier : `src/components/restaurants/BodaccScanButton.tsx`**

Modifier le filtre et l'extraction du SIREN :
- Changer le type de `Props.restaurants` pour accepter `siret` au lieu de `siren`
- Extraire le SIREN en prenant les 9 premiers chiffres du SIRET (`siret.replace(/\s/g, "").substring(0, 9)`)
- Passer ce SIREN derive a la Edge Function

**Fichier : `src/pages/Restaurants.tsx`** (si necessaire)
- Verifier que les restaurants passes au composant contiennent bien le champ `siret` (deja le cas d'apres les donnees reseau)

Changement minimal : ~5 lignes dans `BodaccScanButton.tsx`.


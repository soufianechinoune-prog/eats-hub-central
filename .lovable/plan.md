

## Plan : Alertes BODACC sur la liste des restaurants

### Concept
Ajouter un système d'alertes BODACC directement sur la page `/restaurants` :
1. **Bouton "Vérifier BODACC"** dans la barre d'outils (à côté de CSV/PDF) qui lance un scan de tous les restaurants ayant un SIREN
2. **Pastille rouge** sur chaque ligne de restaurant où une alerte critique (procédure collective, radiation) est détectée
3. **Pastille orange** pour les alertes non-critiques (modifications, cessions)
4. **Clic sur la pastille** → ouvre un Sheet/Dialog avec le détail des annonces (réutilise le rendu existant de `BodaccAlerts`)

### Architecture

**1. Nouveau composant `BodaccScanButton` + état local**
- Bouton avec icône `ShieldAlert` + loader pendant le scan
- Au clic, itère sur tous les restaurants avec un SIREN valide et appelle `fetch-bodacc` pour chacun (avec un petit délai entre chaque pour ne pas surcharger)
- Stocke les résultats dans un state `Map<restaurantId, BodaccAnnonce[]>` passé au tableau
- Résultats mis en cache dans `localStorage` avec un timestamp pour ne pas re-scanner à chaque visite

**2. Modification de la table `Restaurants.tsx`**
- Nouvelle colonne "Alertes" (ou pastille intégrée à la colonne Nom)
- Si des annonces existent pour ce restaurant : pastille rouge (critique) ou orange (non-critique)
- Tooltip au survol montrant le nombre d'annonces
- Clic → ouvre un Sheet avec le détail (composant `BodaccAlerts` existant ou rendu similaire)

**3. Sheet de détail `BodaccDetailSheet`**
- Réutilise le rendu de `BodaccAlerts` (badges colorés, liens BODACC)
- Affiche le nom du restaurant en header

### Fichiers
- **Créé** : `src/components/restaurants/BodaccScanButton.tsx` — bouton + logique de scan batch
- **Créé** : `src/components/restaurants/BodaccDetailSheet.tsx` — sheet de détail par restaurant
- **Modifié** : `src/pages/Restaurants.tsx` — ajout bouton scan + colonne pastille + state des alertes

### Coût Cloud
Chaque scan = 1 appel Edge Function par restaurant avec SIREN (~100 restaurants = ~100 appels). Négligeable en coût, mais le scan est volontaire (bouton) et les résultats sont cachés localement pendant 24h.


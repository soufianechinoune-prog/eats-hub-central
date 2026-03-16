

## Acquittement des alertes BODACC

### Problème
Actuellement, une alerte critique (ex: redressement judiciaire de 2019) remonte **à chaque scan** même si l'utilisateur en a déjà pris connaissance. Cela crée du bruit inutile.

### Solution
Permettre à l'utilisateur de **"Prendre en compte"** chaque alerte individuellement. Les alertes acquittées ne déclenchent plus l'icône ⚠️ dans la liste des restaurants, ni la bannière rouge. Seules les alertes **non acquittées** remontent.

### Changements

**1. Nouvelle table `bodacc_dismissed_alerts`**
- `id` (uuid, PK)
- `restaurant_id` (uuid, FK restaurants)
- `siren` (text)
- `annonce_key` (text) — clé unique composée de `type + date + numeroBodacc` pour identifier chaque annonce
- `dismissed_by` (text, nullable) — nom ou identifiant de l'utilisateur
- `dismissed_at` (timestamptz, default now())
- Index unique sur `(restaurant_id, annonce_key)`
- RLS : accès authentifié en lecture/écriture

**2. `BodaccDetailSheet.tsx`** — Ajouter un bouton "Pris en compte" sur chaque annonce
- Bouton discret (variant ghost, icône `CheckCircle2`) sur chaque carte d'annonce
- Au clic : insert dans `bodacc_dismissed_alerts` avec la clé de l'annonce
- L'annonce acquittée passe en style grisé avec un badge "Pris en compte" et la date
- Possibilité de "Rétablir" (supprimer l'acquittement)

**3. `BodaccScanButton.tsx`** — Filtrer les alertes acquittées
- Après récupération des annonces, charger les acquittements depuis la table
- Ne compter comme "alert" que les annonces **non acquittées** de type critique
- Les annonces acquittées restent visibles dans le détail (grisées) mais ne déclenchent pas l'icône ⚠️ dans la liste

**4. `Restaurants.tsx`** — L'icône ⚠️ ne s'affiche que si des alertes critiques **non acquittées** existent
- Même logique : croiser `bodaccResults` avec les acquittements

**5. `BodaccAlerts.tsx`** (page RestaurantDetail) — Même traitement
- Charger les acquittements pour le SIREN
- Masquer la bannière rouge si toutes les alertes critiques sont acquittées
- Permettre l'acquittement inline

### Flux utilisateur
1. L'utilisateur lance un scan BODACC
2. ⚠️ apparaît sur Chicken Street Marseille (redressement judiciaire 2019)
3. Il ouvre le détail, lit l'annonce, clique **"Pris en compte"**
4. L'alerte passe en grisé, l'icône ⚠️ disparaît de la liste
5. Au prochain scan, cette annonce ne remonte plus comme alerte active
6. Si une **nouvelle** annonce apparaît, elle sera non acquittée et remontera normalement


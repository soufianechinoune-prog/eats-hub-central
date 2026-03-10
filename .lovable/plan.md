

## Plan : Intégrer les alertes légales BODACC sur la fiche restaurant

### Objectif
Afficher les annonces légales (procédures collectives, modifications de capital, radiations, dépôts de comptes) issues du BODACC directement sur la fiche restaurant, en utilisant le SIREN déjà disponible.

### Architecture

**1. Nouvelle Edge Function `fetch-bodacc` (`supabase/functions/fetch-bodacc/index.ts`)**
- Reçoit un SIREN en paramètre
- Appelle l'API BODACC Opendatasoft : `https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?where=registre like "{siren}"&order_by=dateparution desc&limit=20`
- Parse les résultats et retourne un tableau structuré avec : date, type (procédure collective, modification, dépôt comptes, radiation, vente/cession), description, tribunal, lien BODACC
- Gratuit, sans clé API

**2. Nouveau composant `BodaccAlerts` (`src/components/restaurants/BodaccAlerts.tsx`)**
- Prend un `siren` en prop
- Appelle la Edge Function via `supabase.functions.invoke('fetch-bodacc')`
- Affiche les annonces dans un Collapsible/Accordion avec :
  - Badge coloré par type (rouge pour procédures collectives, orange pour modifications, bleu pour dépôts comptes)
  - Date de parution
  - Description (jugement, modification, type de dépôt)
  - Lien vers l'annonce complète sur bodacc.fr
- Alerte visuelle si une procédure collective est détectée

**3. Intégration dans `RestaurantDetail.tsx`**
- Ajouter le composant `BodaccAlerts` dans la section "Informations" de la fiche, juste après le bloc SIRET/adresse
- N'affiche rien si le restaurant n'a pas de SIREN renseigné

### Fichiers modifiés/créés
- **Créé** : `supabase/functions/fetch-bodacc/index.ts`
- **Créé** : `src/components/restaurants/BodaccAlerts.tsx`
- **Modifié** : `src/pages/RestaurantDetail.tsx` (ajout import + composant)
- **Modifié** : `supabase/config.toml` (ajout config pour fetch-bodacc)

### Coût Cloud
- Uniquement au clic/chargement de la fiche restaurant — négligeable (même ordre que validate-siret)


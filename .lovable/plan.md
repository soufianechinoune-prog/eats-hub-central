

## Matching des restaurants Deliveroo

### Objectif
Creer une page dediee pour associer les noms Deliveroo (CSV) aux restaurants en base, et stocker le nom exact Deliveroo dans le champ `deliveroo_store_id` (deja existant, actuellement vide pour tous les restaurants).

### Fonctionnement

1. L'utilisateur uploade un CSV Deliveroo (ex: `rs-performance-report_xxx.csv`)
2. Le systeme parse la colonne "Etablissement" et extrait les noms
3. Pour chaque nom Deliveroo :
   - Nettoyage : retirer "CHICKEN STREET - ", emojis, accents
   - Comparaison fuzzy avec les noms en base (meme nettoyage)
   - Affichage du match propose avec un score de confiance
4. L'utilisateur valide/corrige chaque correspondance via un dropdown
5. Bouton "Enregistrer" : sauvegarde le nom exact Deliveroo dans `restaurants.deliveroo_store_id`

### Cas particuliers geres automatiquement (overrides)

| CSV Deliveroo | Restaurant en base |
|---|---|
| "Grenoble" | Echirolles |
| "Lille Centre" | Lille Flandres |
| "Lille" (seul) | Lille Wazemmes |
| "Boulogne" | Boulogne-Billancourt |
| "Bussy" | Bussy-Saint-Georges |
| "CS Orignial by Chicken Street" | Oberkampf |
| "Evry-Courcouronnes" | Courcouronnes |
| "Crimee" | Paris 19 (si existe) |

Les restaurants hors reseau (ex: "Bangkok Factory") sont ignores automatiquement.

### Interface

Tableau avec 4 colonnes :
- Nom Deliveroo (depuis CSV)
- Restaurant en base (dropdown modifiable)
- Score de confiance (badge vert >= 90%, orange >= 70%, rouge < 70%)
- Statut : deja lie / a confirmer / non trouve

En haut : upload CSV + compteurs
En bas : bouton "Enregistrer les correspondances"

### Acces

- Nouvelle route `/deliveroo-matching`
- Accessible depuis le menu lateral, dans la section ou se trouve deja "Uber Mapping"

### Fichiers concernes

| Fichier | Action |
|---|---|
| `src/pages/DeliverooMatching.tsx` | Nouveau - page complete de matching |
| `src/lib/fuzzyMatch.ts` | Ajouter `matchDeliverooToRestaurant()` avec overrides et nettoyage emojis |
| `src/App.tsx` | Ajouter route `/deliveroo-matching` |
| `src/components/layout/AppSidebar.tsx` | Ajouter lien "Deliveroo Matching" a cote de "Uber Mapping" |

Pas de migration SQL necessaire : le champ `deliveroo_store_id` existe deja dans la table `restaurants`.


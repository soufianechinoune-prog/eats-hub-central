

## Sélecteur de marque (chaîne) global

### Contexte

La table `chains` et le champ `chain_id` sur `restaurants` existent déjà en base. Aujourd'hui, seule "Chicken Street" est présente (en doublon d'ailleurs — 2 entrées). Tout est en place côté données pour supporter plusieurs marques.

### Principe

Ajouter un **sélecteur de marque** dans le `AnalyticsContext` (état global) qui filtre automatiquement **tous les restaurants** affichés sur la plateforme. Quand tu switches de marque, toutes les pages (Dashboard, Analytics, Comparatifs, Restaurants, etc.) ne montrent que les restaurants de cette chaîne.

### Plan technique

**1. Nettoyer la table `chains`**
- Supprimer le doublon (garder un seul "Chicken Street")
- S'assurer que tous les restaurants pointent vers le bon `chain_id`

**2. Ajouter `selectedChainId` dans `AnalyticsContext`**
- Nouvel état `selectedChainId: string | null` (null = toutes les marques)
- Persisté dans localStorage comme les autres filtres
- Exposé via le contexte pour toutes les pages

**3. Créer un sélecteur de marque dans la sidebar**
- Dropdown ou switcher en haut de `AppSidebar.tsx` (sous le logo)
- Affiche les chaînes disponibles + option "Toutes"
- Change le logo/nom affiché selon la marque sélectionnée

**4. Filtrer les restaurants globalement**
- Dans les pages qui fetchent les restaurants (Restaurants, Dashboard, Overview, Comparatifs…), ajouter un filtre `.eq("chain_id", selectedChainId)` quand une chaîne est sélectionnée
- Les restaurants épinglés (`selectedRestaurants`) restent filtrés par la chaîne active

### Ce qui ne change pas
- Aucune modification de structure de base de données (la colonne `chain_id` existe déjà)
- Toutes les données existantes restent intactes
- Le fonctionnement actuel est préservé quand "Toutes" est sélectionné

### Résultat
Tu pourras ajouter un restaurant d'une autre enseigne, créer sa chaîne, et switcher entre "Chicken Street" et la nouvelle marque d'un clic dans la sidebar. Chaque marque aura sa vue isolée sur toute la plateforme.


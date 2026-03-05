

# Ajouter un Co-dirigeant pour recevoir les WhatsApp

## Contexte
Il existe déjà une table `managers` (first_name, last_name, phone, email) et une table de liaison `manager_restaurants` (manager_id, restaurant_id, role, is_primary). Actuellement, la section "Gérant" de la fiche restaurant utilise des champs plats sur la table `restaurants` et ne permet qu'un seul contact.

## Approche
Plutôt que d'ajouter encore des colonnes plats (co_manager_first_name, etc.), on va exploiter les tables `managers` + `manager_restaurants` déjà en place pour gérer un ou plusieurs contacts associés au restaurant.

### 1. Modifier la section "Gérant" dans RestaurantDetail.tsx
- Conserver les champs existants (manager_first_name, manager_last_name, phone, manager_whatsapp) comme gérant principal
- Ajouter en dessous une sous-section "Co-dirigeant(s)" qui liste les managers liés via `manager_restaurants` (hors le gérant principal)
- Bouton "+ Ajouter un co-dirigeant" ouvrant un petit formulaire inline ou dialog avec : Prénom, Nom, Téléphone/WhatsApp, Email
- Chaque co-dirigeant affiché avec possibilité de supprimer

### 2. Requêtes Supabase
- Charger les managers liés au restaurant via `manager_restaurants` JOIN `managers`
- Insérer un nouveau manager dans `managers` + créer la liaison dans `manager_restaurants` avec `role = 'co-dirigeant'`
- Supprimer = retirer la liaison `manager_restaurants` (et potentiellement le manager si plus aucune liaison)

### 3. Impact sur l'envoi WhatsApp (Messaging.tsx)
- Modifier la logique d'envoi pour aussi récupérer les co-dirigeants via `manager_restaurants` → `managers`
- Envoyer le WhatsApp au gérant principal ET aux co-dirigeants qui ont un numéro WhatsApp renseigné

### Fichiers modifiés
- **`src/pages/RestaurantDetail.tsx`** : nouvelle sous-section co-dirigeants dans la carte Gérant, avec CRUD via les tables managers/manager_restaurants
- **`src/pages/Messaging.tsx`** : inclure les co-dirigeants dans la liste des destinataires WhatsApp

Aucune migration SQL nécessaire -- les tables `managers` et `manager_restaurants` existent déjà avec la bonne structure.


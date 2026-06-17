# Marque par défaut = Chicken Street à la connexion

## Comportement souhaité
- À la **première connexion** (ou si rien n'est en mémoire), la marque affichée est **Chicken Street** au lieu de "Toutes les marques".
- L'utilisateur garde **la liberté totale** de basculer ensuite vers une autre marque ou vers "Toutes les marques" via le sélecteur dans la sidebar.
- Le choix de l'utilisateur reste persistant : s'il sélectionne "Toutes les marques" manuellement, ce choix est conservé à la prochaine session.

## Modification

**`src/contexts/AnalyticsContext.tsx`** — Étendre la logique d'auto-sélection (qui ne marche aujourd'hui que pour les utilisateurs mono-marque) :

- Au démarrage, si `selectedChainId === null` ET rien n'est en `localStorage`, charger la liste des chaînes accessibles.
- Chercher celle nommée "Chicken Street" (insensible à la casse) → la sélectionner.
- Fallback : si "Chicken Street" n'est pas dans la liste, prendre la première chaîne par ordre alphabétique.
- Si l'utilisateur a déjà fait un choix (y compris explicitement "Toutes les marques"), ne rien forcer.

Aucune autre modification : sélecteur sidebar, RLS, hooks et routes inchangés.

## Hors scope
- Pas de restriction d'accès aux autres marques
- Pas de modification du dropdown ou de la liste affichée

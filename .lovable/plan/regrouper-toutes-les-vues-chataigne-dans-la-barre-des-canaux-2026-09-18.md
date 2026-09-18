# Regrouper toutes les vues Chataigne dans la barre des canaux

## Organisation proposée

Déplier **Chataigne** dans la barre de droite avec toutes les vues déjà disponibles :

```text
Chataigne
├─ Synthèse
├─ Analyse détaillée
├─ Commandes
├─ Vue quotidienne
├─ Emport vs Livraison
├─ Croissance & Clients
├─ Écarts & Markup
└─ Rentabilité
```

Les cinq premières vues correspondent aux onglets déjà présents dans la page Chataigne. Les trois dernières correspondent aux écrans Chataigne actuellement accessibles séparément dans la navigation principale.

## Mise en place

- Ajouter ces huit entrées sous **Chataigne** dans la barre des canaux.
- Conserver les adresses existantes : les vues internes utilisent `/chataigne?tab=...`, et les écrans dédiés gardent `/chataigne/croissance`, `/chataigne/tarification` et `/chataigne/rentabilite`.
- Afficher la barre des canaux sur les quatre écrans Chataigne, sur ordinateur et dans le panneau mobile.
- Déduire l’entrée active depuis l’adresse complète, y compris le paramètre `tab`, afin que la bonne vue reste sélectionnée après navigation ou actualisation.
- Garder le groupe Chataigne ouvert lorsqu’une de ses vues est affichée.
- Retirer les quatre raccourcis Chataigne de la longue liste de gauche une fois leurs accès disponibles à droite, comme pour l’étape Caisse.

## Garanties

- Aucun changement de données, calculs, filtres ou base de données.
- Aucun changement du contenu des écrans : seule leur navigation est réorganisée.
- Les favoris et liens existants continuent de fonctionner.
- La grille des prix sur place reste partagée et continue d’alimenter les calculs Chataigne.

## Vérification

- Tester chaque entrée Chataigne et son état actif sur ordinateur.
- Tester l’ouverture, la navigation et la fermeture du panneau sur mobile.
- Vérifier le retour vers la synthèse Chataigne et vers la Vue réseau.
- Contrôler que les filtres période et restaurants restent inchangés entre les vues.

## Détails techniques

- Étendre la configuration partagée de la barre des canaux avec les sous-rubriques Chataigne.
- Faire correspondre à la fois le chemin et le paramètre `tab` pour l’état actif.
- Envelopper les écrans Chataigne dédiés avec la navigation partagée sans ajouter un second cadre d’application.
- Préserver les protections d’accès et le chargement différé des pages actuelles.
# Réorganisation progressive de la navigation par canal

## Proposition d’organisation

Conserver deux niveaux clairement séparés :

```text
Barre principale          Barre des canaux
─────────────────         ─────────────────────────
Vue d’ensemble            Vue réseau
Restaurants               Uber Eats
Messagerie                Deliveroo
Rapports hebdo             Caisse
Données / administration    ├─ Synthèse caisse
                            ├─ Ventes sur place
                            ├─ Ventes par produit (à venir)
                            └─ Prix sur place
                          Dishop
                          Chataigne
```

La barre principale reste celle de toute l’application. La seconde barre, déjà présente dans la Vue d’ensemble, devient la navigation analytique permanente et regroupe chaque écran sous son canal réel.

## Étape 1 — Regrouper le canal Caisse

- Rendre la seconde barre visible sur les écrans analytiques concernés, pas seulement dans la Vue d’ensemble.
- Déplier **Caisse** avec :
  - **Synthèse** : la vue Caisse actuellement intégrée à la Vue d’ensemble.
  - **Ventes sur place** : l’écran actuel N/N-1, périmètre constant, détail restaurant et vues quotidiennes.
  - **Ventes par produit** : emplacement préparé pour la future donnée détaillée Splash, sans encore intégrer les fichiers.
  - **Prix sur place** : déplacer son accès dans Caisse tout en conservant l’écran existant.
- Retirer de la longue liste Analytics les doublons « Ventes sur place » et « Prix sur place » une fois leurs nouveaux accès disponibles.
- Garder les adresses actuelles fonctionnelles afin de ne casser aucun favori ou lien existant.

## Comportement attendu

- Le canal actif et sa sous-rubrique restent visuellement sélectionnés après navigation.
- Le groupe contenant la page courante reste ouvert.
- La seconde barre peut être repliée et conserve alors les icônes des canaux.
- Sur petit écran, elle devient un panneau ouvrable plutôt qu’une colonne permanente.
- Les filtres et les données de chaque page restent inchangés.

## Étapes suivantes

Après validation de Caisse, appliquer exactement la même logique, canal par canal :

1. **Uber Eats** : Synthèse, Revenus & Ventes, Articles, Conversion, Finances, Offres, Opérations, Avis, etc.
2. **Deliveroo** : Synthèse, Revenus, Finances, Opérations, Disponibilité, Rentabilité.
3. **Chataigne** : Synthèse, Croissance & Clients, Écarts & Markup, Rentabilité, Emport vs Livraison.
4. **Dishop** : Synthèse d’abord, puis les futurs écrans dédiés.

## Limites de cette première étape

- Aucun changement de calcul, de source, de filtre ou de base de données.
- Aucune ingestion des nouveaux fichiers Splash.
- Aucun grand redesign visuel des pages : uniquement une navigation cohérente et progressive.

## Détails techniques

- Transformer la navigation par canal actuelle en élément partagé par les pages analytiques.
- Déterminer l’élément actif à partir de l’adresse de la page, plutôt qu’avec un état limité à la Vue d’ensemble.
- Préserver les routes existantes et leurs protections d’accès.
- Vérifier la navigation Caisse sur ordinateur et mobile, ainsi que le retour vers Vue réseau.

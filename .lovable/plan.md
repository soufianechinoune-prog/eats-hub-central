# Plan : Matching des avis Uber pour 100 restaurants

## ✅ Terminé

### Interface de mapping créée
- **Page** : `/uber-mapping` accessible via la sidebar (Données → Mapping Uber)
- **Fonctionnalités** :
  1. Upload d'un CSV Uber Eats (avis, ventes, etc.)
  2. Extraction automatique des paires `store_id` / `store_name`
  3. Matching automatique par similarité de nom (≥80%)
  4. Sélection manuelle pour les cas non reconnus
  5. Sauvegarde en masse des associations

## Prochaines étapes

1. **Uploader le CSV** via `/uber-mapping`
2. **Valider les associations** proposées automatiquement
3. **Ré-importer les avis** pour que tous les restaurants soient matchés

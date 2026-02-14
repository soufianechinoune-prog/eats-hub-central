
# Corriger la lisibilite et la pagination du PDF Analytics

## Problemes identifies

1. **Texte petit/illisible** : le scale `1.5` de html2canvas produit une resolution insuffisante
2. **Restaurants coupes** : jsPDF `addImage` ne clippe pas reellement l'image -- le contenu deborde entre les pages au lieu d'etre proprement decoupe
3. **Texte qui se chevauche dans le bandeau meta** : "Restaurants: Tous les restaurants" et "Genere le 14 fevrier 2026 a 12:35" sont sur la meme ligne et se melangent quand le texte est long

## Solution

### Fichier modifie : `src/hooks/useAnalyticsPdfExport.ts`

#### 1. Augmenter la qualite de capture
- Passer `scale` de `1.5` a `2` pour une meilleure lisibilite
- Garder JPEG 80% (au lieu de 75%) pour un bon compromis taille/qualite

#### 2. Corriger la pagination avec un vrai decoupage du canvas
- Au lieu de placer l'image entiere avec un decalage negatif (ce qui ne clippe pas), **decouper le canvas source** en tranches via un canvas intermediaire pour chaque page
- Chaque tranche est convertie en image JPEG independante et placee correctement sur sa page

```text
Canvas source (tres haut)
  |
  +-- Tranche 1 --> Page 1 (sous le header)
  +-- Tranche 2 --> Page 2
  +-- Tranche N --> Page N
```

#### 3. Corriger le bandeau meta
- Passer le bandeau meta sur 2 lignes au lieu d'une seule :
  - Ligne 1 : Periode + Plateforme
  - Ligne 2 : Restaurants + Date de generation
- Augmenter la hauteur du bandeau meta de 12mm a 18mm
- Ajuster `headerHeight` en consequence

#### 4. Augmenter la taille du footer
- Passer le footer de `setFontSize(8)` a `setFontSize(9)` pour meilleure lisibilite

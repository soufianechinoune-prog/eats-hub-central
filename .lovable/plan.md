

## Refonte visuelle du PDF Downtime

### 1. Renommer le fichier PDF

Le nom actuel est `report-Chicken_Street_Juvisy-20260216-xxx.pdf`. Il sera remplace par :
**`Rapport CS Juvisy 16-22 fev 2026.pdf`**

- Utilisation de `extractCityName()` (deja existant dans `restaurantUtils.ts`) pour extraire la ville
- Format de la periode en clair dans le nom du fichier

**Fichiers concernes** : `WeeklyReports.tsx` (ligne 814-816)

---

### 2. Refonte du header (bandeau vert)

Le bandeau vert plein sera remplace par un design professionnel :

- **Fond blanc** au lieu du vert plein
- **Logo Chicken Street** (fichier `src/assets/cs-logo.jpeg` deja present) integre en haut a gauche
- **Titre "Rapport CS [Ville]"** en noir/gris fonce, grand et bold
- **Sous-titre** avec le type de rapport en gris
- **Periode** alignee a droite
- **Ligne de separation** fine en emeraude sous le header pour garder l'identite visuelle

**Fichier concerne** : `useReportPdfExport.ts` (lignes 184-211)

Pour integrer le logo JPEG dans jsPDF, on utilisera la methode `doc.addImage()` avec un import du fichier en base64 via un `fetch()` au runtime.

---

### 3. Design des KPI cards (deja code mais pas applique)

Le code actuel EST correct (fond blanc + texte colore), mais il semble que le build ne soit pas pris en compte. La refonte complete du header forcera la recompilation. Les cards restent :

- Fond blanc, bordure gris clair
- Valeur coloree (vert/orange/rouge selon seuils)
- Sous-titre descriptif

---

### 4. Supprimer les graphiques horaires pour les jours a 100%

Actuellement, les 7 jours affichent un graphique horaire meme quand tout est a 100%. Cela genere 2 pages inutiles.

**Nouvelle logique** : Afficher le graphique horaire UNIQUEMENT pour les jours avec un taux < 100% (au moins une heure avec de l'indisponibilite). 

Si tous les jours sont a 100%, ajouter un simple message de confirmation : "Tous les jours de la periode ont un taux de disponibilite de 100%."

**Fichier concerne** : `useReportPdfExport.ts` (lignes 353-391)

---

### 5. Optimisation du layout general

- Reduire les espaces entre sections
- Ajouter une icone de check (texte) a cote des jours parfaits dans le graphique journalier
- Footer plus discret

---

### Resume des modifications

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useReportPdfExport.ts` | Header blanc avec logo, skip des graphiques horaires 100%, optimisation layout |
| `src/components/messaging/WeeklyReports.tsx` | Nom du fichier PDF avec ville et periode |
| `src/lib/restaurantUtils.ts` | Aucune modification (reutilisation de `extractCityName`) |

### Details techniques

- Le logo sera charge via `fetch()` sur le chemin relatif du JPEG, converti en base64, puis insere avec `doc.addImage(base64, "JPEG", x, y, w, h)`
- La fonction `extractCityName` sera importee dans `useReportPdfExport.ts` et `WeeklyReports.tsx`
- Le filtre des jours 100% comparera chaque heure : si `offline_minutes === 0` pour toutes les heures du jour, le graphique horaire est omis

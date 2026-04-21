

## Diagnostic en 2 points

### 1. Pourquoi l'IDU n'apparaît pas
Le code d'affichage inline est bien en place (lignes 1206-1233), mais il ne s'affiche que si `repData.status === "inscrit"` ET `iduEntries.length > 0`.

Sur ta capture, les restaurants visibles sont soit :
- **"Non adhérent"** (Clichy, Montigny, Vaulx en Velin) → pas d'IDU par définition
- **"Adhérent"** (Les Lilas, Saint-Denis, Mulhouse, etc.) → ils sont marqués adhérents mais `iduEntries` est vide, donc rien ne s'affiche

Le problème : pour les "Adhérent" basés uniquement sur le **dataset annuel** (sans IDU dans le dataset quotidien), `iduEntries = []` et `entries[].matchingIdu = undefined`. Du coup la ligne reste vide.

**Correction** : afficher aussi les `entries` même sans IDU rattaché, en montrant juste la filière + dates d'adhésion. Et s'assurer que le bloc s'affiche dès qu'il y a au moins une `entry`, pas seulement si `iduEntries.length > 0`.

En relisant le code (ligne 1207) : la condition est `iduEntries.length > 0 || entries.length > 0` — donc elle devrait passer. Le vrai souci : pour les adhérents annuels, `entries` contient bien les filières mais avec `start`/`end` issus du dataset annuel. Vérifier que ces champs sont correctement remplis dans le mapping ligne 171-182.

### 2. Le badge "Perdu" (ligne 1041)
Il s'affiche sous "Non adhérent" quand le restaurant **était adhérent lors d'un scan précédent** et ne l'est plus maintenant. Détecté par `useRepCheckPersistence` qui compare le snapshot actuel au précédent (`changeType === "lost_adherent"`).

→ Sur ta capture, Clichy, Montigny et Vaulx en Velin étaient marqués "Adhérent" lors d'un scan précédent et sont passés à "Non adhérent" maintenant.

## Corrections à apporter

### A. Renommer "Perdu" en quelque chose de plus clair
Remplacer le label `Perdu` (ligne 1041) par `Adhésion perdue` avec un tooltip explicatif : *"Ce restaurant était inscrit au REP lors du scan précédent, mais ne l'est plus aujourd'hui."*

Idem pour `Nouveau` (ligne ~1022) → `Nouvel adhérent` avec tooltip *"Ce restaurant n'était pas inscrit au REP lors du scan précédent."*

### B. Forcer l'affichage de l'IDU + dates pour TOUS les adhérents
Modifier le bloc inline (lignes 1206-1233) pour :
1. Si `iduEntries.length > 0` → afficher les badges IDU bleus
2. Sinon, afficher un badge gris **"Adhésion annuelle (sans IDU)"** pour expliquer pourquoi il n'y a pas de numéro
3. Toujours afficher les `entries` (filière + dates) tant que `entries.length > 0`

### C. Debug temporaire
Ajouter un `console.log` dans le mapping (ligne ~155) pour vérifier ce que `result.idu_results` contient réellement pour les "Adhérent" affichés sans IDU. Si le backend ne renvoie pas d'IDU pour ces restaurants, c'est normal qu'aucun numéro ne s'affiche — il faut alors clarifier visuellement (point B).

## Fichier modifié
- `src/components/analytics/EcoContributionSection.tsx` — labels "Perdu"/"Nouveau" + tooltips, et bloc d'affichage IDU/entries plus permissif avec fallback "Adhésion annuelle (sans IDU)"

## Résultat attendu
- "Perdu" devient explicite avec un tooltip
- Tous les adhérents affichent quelque chose sous leur nom : soit l'IDU, soit un badge expliquant pourquoi il n'y a pas d'IDU disponible
- Tu sauras immédiatement si le problème vient du backend (aucun IDU renvoyé) ou de l'affichage


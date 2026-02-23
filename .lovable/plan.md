

## Correction du calcul de disponibilite sur la page Comparaison et l'export PDF

### Le probleme

Le meme bug que sur la page Analytics : le taux de disponibilite est calcule comme un ratio brut (total online / total minutes) au lieu d'une **moyenne des taux journaliers**. Juvisy affiche 52.9% sur la comparaison au lieu de 84.4% (la bonne valeur, coherente avec le graphique).

### Fichiers a corriger

**1. `src/pages/DowntimeComparison.tsx` (ligne 244)**

Remplacer le calcul brut :
```text
Avant : totalOnline / (totalOnline + totalOffline) * 100
```

Par une moyenne des taux journaliers, en reutilisant le `dailyAvailability` qui est deja calcule juste en dessous (lignes 254-266) et qui applique correctement la regle "0/0 = 100%".

Concretement : apres avoir construit `dailyAvailability`, calculer `availabilityRate` comme la moyenne des `v.rate` de chaque jour.

**2. `src/hooks/useReportPdfExport.ts` (ligne 282)**

Meme correction pour l'export PDF : calculer le taux comme moyenne des taux journaliers a partir du `dailyMap` deja construit (lignes 270-273), au lieu du ratio brut.

### Impact

- La page Comparaison affichera les memes taux que la page Analytics (84.4% pour Juvisy)
- Les exports PDF seront coherents
- Le classement et les badges (Critique, Bon, Excellent) refleteront les bonnes valeurs

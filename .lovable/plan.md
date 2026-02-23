
## Correction du calcul du taux de disponibilite (KPI inconsistant)

### Probleme identifie

Quand une heure n'a aucune donnee (online_minutes = 0 ET offline_minutes = 0), les KPI affichent **0%** de disponibilite alors que le graphique affiche **100%**. Les deux se contredisent.

Cas concrets observes :
- **20 fevrier** : Restaurant ferme toute la journee, KPI = "0.0%" mais graphique = "100%" sur toutes les heures
- **21 fevrier** : Seulement 2h d'activite (48 min online, 158 min offline), KPI = "23.3%" alors que le graphique montre 100% pour les 22 heures sans donnees

### Cause racine

Deux formules differentes dans `OperationsAnalytics.tsx` :

```text
KPI (ligne 261/369) : totalMinutes > 0 ? (online/total)*100 : 0     --> defaut 0%
Graphique (ligne 351) : total > 0 ? (online/total)*100 : 100         --> defaut 100%
```

### Correction

Aligner les KPI sur la meme logique que le graphique : quand il n'y a aucune minute enregistree, c'est "pas de downtime detecte" = **100%** par defaut.

### Modifications dans `src/components/analytics/OperationsAnalytics.tsx`

1. **Ligne 261** (KPI general) : changer le defaut de `0` a `100`
   - Avant : `avgAvailability: totalMinutes > 0 ? (totalOnline / totalMinutes) * 100 : 0`
   - Apres : `avgAvailability: totalMinutes > 0 ? (totalOnline / totalMinutes) * 100 : 100`

2. **Ligne 369** (KPI jour) : meme correction
   - Avant : `avgAvailability: totalMinutes > 0 ? (totalOnline / totalMinutes) * 100 : 0`
   - Apres : `avgAvailability: totalMinutes > 0 ? (totalOnline / totalMinutes) * 100 : 100`

### Impact

- Les KPI et le graphique seront maintenant coherents
- Un jour sans donnees affichera 100% (pas de downtime) au lieu de 0%
- Le 21 fevrier affichera toujours 23.3% car les heures avec donnees ne changent pas
- Aucun impact sur les autres pages (la comparaison reseau utilise sa propre logique)

### Fichier concerne

| Fichier | Modification |
|---------|-------------|
| `src/components/analytics/OperationsAnalytics.tsx` | Corriger le defaut de 0 a 100 quand aucune donnee n'est disponible (2 lignes) |

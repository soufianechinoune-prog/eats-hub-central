
## Deux corrections pour la page "Temps d'inactivite"

### Probleme 1 : L'ordre du PDF ne respecte pas le tri de l'ecran

**Cause** : Le classement affiche a l'ecran est gere par un etat local `sortDirection` dans le composant `DowntimeRankingBars`. Mais quand tu cliques sur "PDF", la fonction d'export recoit les donnees dans leur ordre par defaut (meilleurs en premier), sans tenir compte du tri que tu as choisi a l'ecran.

**Solution** : Remonter l'etat de tri (`sortDirection`) dans la page `DowntimeComparison.tsx` pour qu'il soit partage entre le composant d'affichage ET la fonction d'export PDF. Avant d'exporter, les stats seront re-triees selon le sens choisi par l'utilisateur.

Fichiers concernes :
- `src/pages/DowntimeComparison.tsx` : ajouter un etat `sortDirection`, le passer au composant et a la fonction d'export
- `src/components/compare/DowntimeRankingBars.tsx` : recevoir `sortDirection` et `onSortDirectionChange` en props au lieu de gerer l'etat en interne
- `src/hooks/useDowntimeExport.ts` : appliquer le tri recu dans `data.stats` avant de generer le tableau PDF (et Excel)

---

### Probleme 2 : Le 21 fevrier affiche 100% alors qu'il n'y a pas de donnees

**Cause** : La table `hourly_availability` ne contient des donnees que jusqu'au **20 fevrier 2026**. Le 21 fevrier n'a aucun enregistrement. Or le code utilise cette logique :

```text
availabilityRate = totalMinutes > 0 ? (online / total * 100) : 100
```

Quand il n'y a aucune donnee pour une journee, le systeme affiche 100% par defaut au lieu d'indiquer que la donnee est absente.

**Solution** : Ce n'est pas un bug de code mais un **manque de donnees**. Le rapport "Disponibilite" d'Uber Eats pour la semaine du 17-21 fevrier n'a probablement pas encore ete importe, ou bien seules les journees du 18-20 ont ete couvertes. Il faut importer le dernier rapport de disponibilite pour que les jours recents apparaissent avec leurs vraies valeurs.

---

### Resume des modifications de code

| Fichier | Modification |
|---------|-------------|
| `DowntimeComparison.tsx` | Ajouter etat `sortDirection`, le passer au ranking et a l'export |
| `DowntimeRankingBars.tsx` | Recevoir le tri en props (controlled component) |
| `useDowntimeExport.ts` | Trier les stats selon la direction recue avant d'ecrire le PDF/Excel |

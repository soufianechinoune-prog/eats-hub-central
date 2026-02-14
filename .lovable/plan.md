
# Alerte "Historique limité" sur la page Temps d'inactivité

## Objectif

Afficher un bandeau d'avertissement visible lorsque la période sélectionnée tombe (totalement ou partiellement) avant la date la plus ancienne de données disponibles. Cela evitera de presenter des taux de disponibilite a 100% qui sont en realite dus a l'absence de donnees importees.

## Comportement

- Le systeme interroge la base pour connaitre la date la plus ancienne dans la table `hourly_availability` (plateforme Uber Eats)
- Si la date de debut de la periode selectionnee est **anterieure** a cette date, un bandeau orange (warning) s'affiche sous le header :
  - **Texte** : "Historique limité -- Les données de disponibilité Uber Eats ne sont disponibles qu'à partir du [date]. Les résultats affichés pour la période antérieure peuvent être incomplets ou non représentatifs."
- Si la periode est **entierement** avant la premiere date disponible, le message est plus explicite :
  - **Texte** : "Aucune donnée disponible -- Aucun historique de disponibilité Uber Eats n'a été importé pour cette période. Les résultats affichés ne sont pas exploitables."
- Le bandeau disparait automatiquement quand la periode selectionnee est entierement couverte par les donnees

## Details techniques

### Fichier modifie : `src/pages/DowntimeComparison.tsx`

1. Ajouter une requete pour recuperer la date la plus ancienne :
```typescript
const { data: earliestDate } = useQuery({
  queryKey: ["downtime-earliest-date"],
  queryFn: async () => {
    const { data } = await supabase
      .from("hourly_availability")
      .select("hour_start")
      .eq("platform", "uber_eats")
      .order("hour_start", { ascending: true })
      .limit(1);
    return data?.[0]?.hour_start ? parseISO(data[0].hour_start) : null;
  },
});
```

2. Ajouter un `useMemo` pour determiner le type d'alerte :
   - `"full"` si toute la periode est avant la premiere date
   - `"partial"` si seul le debut de la periode est avant
   - `null` si la periode est entierement couverte

3. Afficher un composant `Alert` (deja disponible dans `src/components/ui/alert.tsx`) avec une icone `AlertTriangle` de Lucide, positionne juste apres le header et avant le contenu principal

### Aucun autre fichier cree ou modifie

La logique est entierement contenue dans la page `DowntimeComparison.tsx` en utilisant les composants `Alert`, `AlertTitle` et `AlertDescription` deja existants.

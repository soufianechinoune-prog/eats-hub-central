
## Fix : afficher IDU + date d'adhésion directement dans le tableau

### Problème
Dans `RestaurantDrilldown` (ligne 1196-1205 de `EcoContributionSection.tsx`), la `TableCell` du nom de restaurant n'affiche que le nom. L'IDU et les dates d'adhésion sont enfouis dans `RepDetailPanel`, qui n'apparaît que si la ligne est dépliée (`open && hasRepDetail`, ligne 1249).

### Correction
Modifier la `TableCell` du nom (lignes 1196-1205) pour ajouter, **sous le nom du restaurant**, une rangée compacte d'infos REP visible dès que `repData` existe (donc dès que `repChecked = true`).

### Code proposé (à insérer dans la TableCell du nom)

```tsx
<TableCell className="font-medium text-sm py-3">
  <div className="flex items-center gap-2">
    <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-90")} />
    <span className={cn(
      "inline-block h-2 w-2 rounded-full flex-shrink-0",
      r.net >= 0 ? "bg-green-500" : "bg-red-500"
    )} />
    {name}
  </div>

  {/* ── Infos REP inline (visibles sans déplier) ── */}
  {repData?.status === "inscrit" && (repData.iduEntries.length > 0 || repData.entries.length > 0) && (
    <div className="ml-[22px] mt-1 flex flex-wrap items-center gap-1.5">
      {/* Badges IDU */}
      {repData.iduEntries.map((idu, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 font-mono text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded"
          title={`Filière ${idu.filiere}`}
        >
          <Hash className="h-2.5 w-2.5" />
          {idu.identifiant_unique}
        </span>
      ))}

      {/* Date(s) d'adhésion — la 1re entrée active, ou toutes si peu nombreuses */}
      {repData.entries.slice(0, 2).map((entry, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
        >
          <CalendarDays className="h-2.5 w-2.5" />
          {entry.filiere} : du {entry.start} au {entry.end ? fmtDateShort(entry.end) : "En cours"}
          {!entry.isActive && <Badge variant="destructive" className="text-[8px] h-3.5 px-1 ml-0.5">Expiré</Badge>}
        </span>
      ))}
      {repData.entries.length > 2 && (
        <span className="text-[10px] text-muted-foreground italic">+{repData.entries.length - 2}</span>
      )}
    </div>
  )}
</TableCell>
```

### Comportement
- Dès que `repChecked = true`, chaque ligne "Adhérent" affiche directement sous son nom :
  - Un ou plusieurs **badges IDU** bleus (un par filière)
  - La **date d'adhésion** au format "Filière : du JJ/MM/AAAA au En cours"
- Affichage limité aux 2 premières entrées avec un compteur "+N" pour éviter de surcharger la ligne ; le détail complet reste accessible en dépliant.
- `RepDetailPanel` (panneau déplié) reste inchangé pour l'affichage exhaustif (orgs, IDU non rattachés, etc.).

### Fichier modifié
- `src/components/analytics/EcoContributionSection.tsx` (lignes 1196-1205 uniquement)

Tu veux que j'applique tel quel, ou tu préfères ajuster le seuil (ex : afficher toutes les entrées sans tronquer à 2) avant ?

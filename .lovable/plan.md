

## Correction du calcul du KPI "Taux de disponibilite"

### Le probleme

Le KPI affiche **23.3%** alors que le graphique montre :
- 19 fev : 100%
- 20 fev : 100%
- 21 fev : 23.3%
- 22 fev : 100%

La moyenne devrait etre **(100 + 100 + 23.3 + 100) / 4 = ~80.8%**

### Cause technique

Le calcul actuel additionne tous les `online_minutes` et `offline_minutes` bruts de la periode, puis fait le ratio. Quand un restaurant a des enregistrements avec `online=0, offline=0` (jours sans activite tracee), ces jours ne contribuent rien au total -- ils sont ignores. Le KPI ne reflete donc que les jours avec de vrais donnees (ici uniquement le 21).

Le graphique, lui, applique la regle "0/0 = 100%", d'ou l'incoherence.

### La solution

Calculer le KPI comme **moyenne des taux journaliers** au lieu d'un ratio de totaux bruts. Chaque jour avec `online=0, offline=0` sera traite comme 100% (coherent avec le graphique).

### Modifications

**Fichier : `src/components/analytics/OperationsAnalytics.tsx` (lignes 236-266)**

Modifier le calcul du `kpis` dans le `useMemo` :

```text
Avant : totalOnline / (totalOnline + totalOffline) * 100
Apres : moyenne des (dayOnline / (dayOnline + dayOffline) * 100) par jour
        avec la regle : si dayOnline + dayOffline == 0, le taux = 100%
```

Concretement, pour le mode `useDailyView` (periodes courtes), on boucle sur `dailyRpcData` et on calcule le taux de chaque jour individuellement, puis on fait la moyenne. Pour le mode annuel (`monthlyRpcData`), meme logique par mois.

Les heures en ligne et hors ligne (KPIs secondaires) restent calcules par somme brute -- seul le pourcentage de disponibilite change.

### Impact

- Coherence parfaite entre le KPI et le graphique
- Les restaurants avec des jours "sans donnees" ne seront plus penalises artificiellement
- Aucun impact sur les autres pages (comparaison, exports) qui ont leur propre calcul

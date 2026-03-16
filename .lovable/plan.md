

## Deux corrections à apporter

### 1. La notice ADEME est au mauvais endroit

La notice "Source ADEME" a été ajoutée dans `RepMembershipSection.tsx`, un composant **qui n'est pas utilisé** sur la page. La page `/analytics/eco-contribution` utilise `EcoContributionSection.tsx` qui a sa propre logique REP intégrée. Il faut donc :

- **Supprimer** la notice inutile dans `RepMembershipSection.tsx` (lignes 163-169)
- **Ajouter** la notice dans `EcoContributionSection.tsx`, juste sous la barre "Adhésion REP (éco-organismes)" (après ligne ~560), visible quand les résultats sont affichés ou avant la première vérification. Texte discret en `text-[10px] text-muted-foreground` :

> *Source ADEME — Adhérents : mise à jour 1×/an (juin). IDU : trimestriel (janv., avr., juil., oct.). Dernière MàJ : 2 fév. 2026.*

### 2. Indicateur visuel "Prélèvement sans adhésion"

Bonne idée : si un restaurant a des prélèvements éco-contribution mais n'est **pas** trouvé comme adhérent REP, c'est une anomalie à signaler. Pour chaque ligne du tableau :

- Croiser `byRestaurant` (qui contient `charge > 0`) avec `repByRestaurant` (statut `non_trouve` ou `sans_siret`)
- Afficher un petit badge d'alerte orange/rouge sur la ligne du tableau, par exemple :
  - 🔶 **"Prélevé sans adhésion"** — un `Badge` variant `destructive` ou `outline` avec icône `ShieldAlert`
  - Apparaît dans la colonne REP ou à côté du solde, uniquement quand `charge > 0` ET statut ≠ `inscrit`

Cela permet aux franchisés de voir immédiatement quels restaurants sont facturés par Uber pour l'éco-contribution sans être enregistrés auprès de l'ADEME — une anomalie à résoudre.

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/components/analytics/EcoContributionSection.tsx` | Ajouter notice ADEME + badge "Prélevé sans adhésion" dans les lignes tableau |
| `src/components/analytics/RepMembershipSection.tsx` | Supprimer la notice inutile (optionnel, fichier non utilisé) |


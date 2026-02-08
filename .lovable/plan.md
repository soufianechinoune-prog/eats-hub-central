

# Proteger les 4 restaurants historiques lors du mapping

## Probleme identifie

Les 4 restaurants historiques ont des **UUIDs differents** dans le fichier CSV par rapport a ceux stockes en base de donnees :

| Restaurant | UUID en DB | UUID probable dans CSV |
|------------|------------|------------------------|
| CHICKEN STREET ATHIS-MONS | `adeed447-6821-47e0-bd14-fcb991229f13` | (different) |
| CHICKEN STREET BONNEUIL-SUR-MARNE | `723fa695-f889-4132-9c39-4fbe35d18c54` | (different) |
| CHICKEN STREET ANTONY | `250e04f7-0234-5bcd-a4c8-6ea5d125a302` | (different) |
| CHICKEN STREET JUVISY-SUR-ORGE | `051979ae-34a3-4ddc-9ac0-d430efdcc0a5` | (different) |

L'outil cherche un match exact par UUID (ligne 150-152), et comme les UUIDs ne correspondent pas, il passe au matching par nom. Mais le matching par nom echoue aussi car :
- CSV : `Chicken Street - Athis-Mons` (avec tiret)
- DB : `CHICKEN STREET ATHIS-MONS` (sans tiret)

L'algorithme `extractLocationPart` cherche ` - ` dans le nom pour extraire la ville, mais le nom en DB n'a pas ce format.

## Solution

Ameliorer l'algorithme de matching pour :

1. **Matcher les restaurants historiques malgre le format different**
   - Normaliser les noms en supprimant les tirets ET en comparant sans format specifique
   - Exemple : `chicken street athis-mons` (du CSV) doit matcher avec `chicken street athis-mons` (de la DB apres normalisation)

2. **Changer l'action pour ces 4 restaurants**
   - Au lieu de "Creer", proposer "Mettre a jour l'UUID" pour lier le nouvel UUID du CSV au restaurant existant
   - Cela preserve toutes les donnees historiques tout en ajoutant le bon UUID

## Modifications techniques

**Fichier**: `src/lib/fuzzyMatch.ts`

Ajouter une normalisation plus agressive qui supprime aussi les tirets et espaces multiples :

```typescript
export const normalizeForLooseMatch = (name: string): string => {
  return normalizeName(name)
    .replace(/ - /g, " ")  // Remplacer " - " par un simple espace
    .replace(/-/g, " ")     // Supprimer les tirets restants
    .replace(/\s+/g, " ")   // Normaliser les espaces
    .trim();
};
```

**Fichier**: `src/pages/UberStoreMapping.tsx`

1. **Inclure les restaurants avec vrais UUIDs dans le matching par nom** si le matching UUID echoue :
   - Si un restaurant avec vrai UUID a un nom tres similaire (>=95%), proposer de mettre a jour son UUID
   
2. **Ajouter une action "update_uuid"** pour distinguer :
   - `rename` : changer le nom + l'UUID (restaurants avec placeholder)
   - `update_uuid` : garder le nom mais mettre a jour l'UUID (restaurants historiques)

3. **Afficher differemment les restaurants historiques** :
   - Badge jaune "Mettre a jour UUID" au lieu de vert "Creer"
   - Montrer le nom actuel en DB pour confirmation

## Resultat attendu

Apres cette modification :
- Les 4 restaurants historiques s'afficheront en "Mettre a jour UUID" (badge jaune)
- Appliquer les changements mettra a jour uniquement leur `uber_store_id` sans creer de doublon
- Toutes les donnees historiques (commandes, reviews, stats) seront preservees
- Les futurs imports de payout fonctionneront car les UUIDs correspondront

## Alternative simple (si tu preferes)

Si tu ne veux pas risquer de modifications, je peux aussi simplement **ignorer les restaurants qui ont deja un vrai UUID** et ne pas les afficher dans la liste. Ainsi :
- Les 4 historiques n'apparaitront tout simplement pas
- Tu ne pourras pas les modifier accidentellement
- Tu devras mettre a jour leurs UUIDs manuellement si necessaire

Dis-moi quelle approche tu preferes.


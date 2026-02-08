
## Ce qui se passe (explication simple)

Sur l’écran **/report-import**, ton fichier contient des `store_id` au format **UUID** (ex: `adeed447-...`).  
Mais dans la base, tes restaurants ont encore des `uber_store_id` au format **placeholder** (`name:chicken street - ...`) ou un code type **BYS00708**.

Je l’ai vérifié côté base : actuellement, **aucun restaurant n’a un `uber_store_id` au format UUID**, donc l’import ne peut pas reconnaître les restaurants → tout part en `unknown_restaurant` et “lignes ignorées”.

Donc le vrai problème n’est plus “le fuzzy match” : c’est que **l’outil /uber-mapping n’a pas réellement écrit les UUIDs en base** (ou il ne lit pas la bonne colonne dans ton CSV).

---

## Hypothèse la plus probable (et la plus fréquente)

Le CSV utilisé pour le mapping n’est pas parsé correctement côté navigateur (délimiteur `;` vs `,`, guillemets, colonnes dupliquées “Id. du restaurant”, BOM, etc.).  
Résultat : l’écran de mapping affiche des choses, mais il n’extrait pas le **vrai UUID** à mettre dans `uber_store_id`, donc il n’update rien d’utile.

---

## Objectif

1) Faire en sorte que **/uber-mapping récupère toujours le bon store_id UUID** depuis le CSV.  
2) Appliquer :  
   - soit **update_uuid** (si on veut juste lier l’UUID)  
   - soit **rename + update uuid** (si on veut enlever les majuscules, aligner le nom “Chicken Street - …”)  
3) Vérifier automatiquement après “Appliquer” que des UUIDs existent bien en base.

---

## Changements à implémenter

### A) Rendre le parsing CSV de `/uber-mapping` robuste
**Fichier :** `src/pages/UberStoreMapping.tsx`

- Ajouter une fonction de parsing CSV “propre” (gestion :
  - séparateur `,` ou `;` (auto-détection sur la ligne d’en-têtes)
  - guillemets `"`
  - cellules contenant des virgules/points-virgules
  - lignes vides
)
- Normaliser les en-têtes (trim, minuscules, suppression BOM `\uFEFF`, espaces insécables).
- Trouver la colonne store_id de façon fiable :
  - si plusieurs “Id. du restaurant”, choisir celle dont les valeurs ressemblent à un UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
  - sinon fallback sur la dernière occurrence comme aujourd’hui
- Trouver la colonne nom de restaurant (Nom du restaurant / Restaurant / store_name).

**Pourquoi ça corrige ton cas :**
Même si Uber change le format (ou si ton export est en `;`), on récupère quand même le bon UUID.

---

### B) Ajouter une “sécurité anti-fausse import” dans `/uber-mapping`
Toujours dans `src/pages/UberStoreMapping.tsx`

Avant de générer les actions :
- Compter combien de `storeId` extraits sont des UUIDs.
- Si ~0 UUID détecté, afficher un toast rouge explicite du style :
  - “Je n’ai trouvé aucun store_id au format UUID dans ce fichier. Vérifie que tu as bien exporté le bon rapport / le bon séparateur.”

Après “Appliquer les changements” :
- Re-fetch des restaurants
- Vérifier que les 4 restaurants ciblés ont maintenant un `uber_store_id` UUID
- Si non, afficher une erreur claire au lieu de laisser croire que c’est bon.

---

### C) Corriger le matching “BYSxxxx” (Antony) pour forcer `update_uuid` sans ambiguïté
**Fichier :** `src/pages/UberStoreMapping.tsx`

Actuellement, tout ce qui n’est pas `name:` est considéré “real UUID” dans `restaurantsWithRealUUID`, ce qui inclut `BYS00708` (qui n’est pas un UUID).

- Ajuster la notion de “real UUID” :
  - considérer “réel” uniquement si `uber_store_id` matche une regex UUID.
  - ainsi BYS… sera traité comme un identifiant non fiable → on pourra le migrer vers un UUID officiel.

---

### D) (Optionnel mais recommandé) Aider l’utilisateur depuis `/report-import`
**Fichier :** `src/pages/ReportImport.tsx`

Quand `unknownStoreIds.length > 0` :
- ajouter un bouton “Ouvrir le mapping Uber Eats” qui amène vers `/uber-mapping`
- et un micro-texte : “Il faut configurer les store_id avant d’importer ces fichiers multi-restaurants.”

Ce n’est pas obligatoire pour corriger, mais ça évite la confusion “j’ai fait le matching mais ça marche pas”.

---

## Vérification (ce que tu pourras tester juste après)

1) Aller sur `/uber-mapping`
2) Importer le même CSV que celui qui te donne des unknown store ids dans `/report-import`
3) Vérifier que tu vois bien :
   - pour Bonneuil + Juvisy : une action de type **Renommer** ou **Mettre à jour UUID**
   - et surtout que le store_id affiché ressemble à un UUID
4) Cliquer “Appliquer”
5) Revenir sur `/report-import` et relancer “Analyser avant import”
   - l’alerte “Restaurants non configurés” doit disparaître (ou fortement diminuer)

---

## Notes importantes (data préservée)

- Changer le **nom** (enlever les majuscules) ne touche pas l’historique : l’historique est lié au `restaurant.id`.
- Mettre à jour `uber_store_id` sert justement à relier tes fichiers Uber (UUID) à tes restaurants existants, sans bouger la data.

---

## Risques / Edge cases couverts

- CSV en `;` au lieu de `,`
- colonnes dupliquées “Id. du restaurant”
- UUID parfois vide sur certaines lignes
- noms tronqués (“Bonneuil” vs “Bonneuil-sur-Marne”)
- codes non-UUID (BYS…) traités correctement (migrables)

---

## Livrables (liste des fichiers)

- `src/pages/UberStoreMapping.tsx` (principal : parsing + détection UUID + correction “real UUID”)
- `src/pages/ReportImport.tsx` (optionnel : bouton/UX vers mapping)

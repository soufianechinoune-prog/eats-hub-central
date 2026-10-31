# Contrôle bloquant des réimports — 31 octobre 2026

Relevé brut : `2e2c480d-118c-4b48-b0fd-59674416bc54-common_template_for_europe_middle_east_africa_with_om.csv`, Chicken Street — Angers.

1 858 lignes de données dont 28 ajustements. Deux imports réels avec `adjustmentsOnly=true` : aucune commande réécrite.

| Contrôle | Import 1 | Import 2 |
|---|---:|---:|
| Ajustements sources traités | 28 | 28 |
| Lignes présentes dans les trois versements contrôlés | 30 | 30 |
| Clés sources distinctes | 28 | 28 |
| Doublons | 0 | 0 |
| Erreurs | 0 | 0 |
| Somme des trois versements contrôlés | −704,43 € | −704,43 € |

Deux lignes historiques absentes de ce fichier restent conservées. Sept anciens groupes sont archivés, avec leurs montants, catégories et données d'origine. Les totaux de chacun des groupes sont identiques au centime avant/après.

Le groupe −199,73 € contient effectivement quatre lignes brutes : −76,65 €, −41,43 €, −81,21 €, −0,44 €. Aucune ventilation inventée.

## Blocage de l'étape 2

Les lignes génériques « Autres frais » ne contiennent pas de tarif explicite ni la période de cotisation. La date du mouvement ne prouve pas la semaine couverte. La recherche dans les CSV disponibles ne fournit pas une date exacte démontrée de bascule 0,1363 → 0,1381.

La preuve d'idempotence est acquise, pas celle du tarif daté ni du traitement fiscal. En respectant l'ordre demandé, la classification finale, l'appariement et la ré-ingestion massive ne sont pas lancés. Les chiffres attendus pour Angers et les reliquats réseau ne sont pas certifiés et ne doivent pas encore servir de réclamation.
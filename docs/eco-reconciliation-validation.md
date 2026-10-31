# Éco-contribution — contrôle du 31 octobre 2026

## Implémentation validée

- Fenêtres de barèmes candidats recouvrantes ; HT/TTC non certifié.
- Calculs en unités entières, tolérance 0,01 €, plancher 5 €, volume réel ±10 %.
- Les doubles correspondances restent candidates ; résolution par toutes les séquences monotones possibles du même restaurant. Les indécidables restent « à confirmer ».
- Bascule fondée uniquement sur des observations indépendantes à période documentée ; contradictions conservées. Zéro observation n'est pas preuve de zéro contradiction.
- Appariement miroir limité aux périodes documentées, montants identiques et rapprochements uniques. Un remboursement global n'est pas automatiquement ventilé.
- Audit séparé, isolé par enseigne, sans écriture des montants ni promotion des anciens agrégats.
- Import atomique par groupe : aucun groupe fusionné coupé à la frontière des lots de 100 lignes.
- Les erreurs du parseur Paiements remontent au webhook : un échec n'est plus annoncé comme un import réussi.
- 27 tests réussis ; contrôle réel du refus 401 sans compte et 403 sur une mauvaise enseigne. Build OK.

## Réimports réels supplémentaires

Rapport Angers janvier 2024 reçu de l'API : 37 lignes sources, deux imports avec `adjustmentsOnly=true`.

| Contrôle | Import 1 | Import 2 |
|---|---:|---:|
| Lignes sources traitées | 37 | 37 |
| Lignes présentes dans les versements ciblés | 38 | 38 |
| Doublons | 0 | 0 |
| Somme de tous les ajustements ciblés | −1 192,72 € | −1 192,72 € |

Somme identique à celle avant remplacement. La ligne historique hors source reste conservée. Ce contrôle n'est pas une recette du total annuel éco.

## Blocages constatés sur les sources réelles

Les demandes Uber janvier 2026, janvier 2025 puis janvier 2024 ont été acceptées et les rapports reçus. L'API ne s'est donc pas révélée limitée à 188 jours sur ces trois tests ; cela ne prouve pas une couverture historique exhaustive.

- Janvier 2026 : un groupe « Autres frais » historique à +115,43 € correspond à une somme source nulle dans la fenêtre demandée ; un groupe publicitaire −27,49 € à −152,71 €. Remplacement bloqué, montants anciens conservés.
- Janvier 2025 : un groupe publicitaire −61,38 € correspond à −118,41 €. Remplacement bloqué.
- La fenêtre par date de commande ne garantit pas que tous les mouvements de la semaine de versement sont présents. Élargir la source puis rapprocher les groupes complets est nécessaire ; ne pas supprimer le garde-fou.
- Audit final Angers : 104 agrégats historiques, 8 lignes ne passant pas le contrôle de volume, 16 montants sous 5 €, 1 remboursement sans période de cotisation documentée ; aucune bascule exploitable ou paire miroir démontrée.
- Exemple : −76,65 € donne 555 commandes à 0,1381 €, mais le versement rattaché contient 722 commandes. Il ne passe pas le contrôle ±10 %. La période couverte doit être identifiée, pas déduite du versement.
- Ré-ingestion massive non lancée : les sources complètes et périodes nécessaires ne sont pas établies. Les trois demandes étaient des sondes d'accès sur un seul restaurant, pas des vagues réseau.

## Résultats demandés, dans l'ordre

1. Angers 1 226,46 / 1 108,38 / −118,08 € : non validé, ne pas forcer les totaux attendus.
2. Bascule 0,1363 → 0,1381 : indéterminée. Le compteur de contradictions sur zéro observation exploitable n'est pas un résultat probant.
3. Total réellement EN ATTENTE : indéterminé tant que les remboursements ne sont pas rapprochés.

Totaux de l'ancien classement, 2024–2026, **non certifiés et non réclamables** :

| Enseigne | Classé prélevé | Classé remboursé | Restaurants ayant des lignes | EN ATTENTE rapproché |
|---|---:|---:|---:|---|
| Chicken Street | 150 493,08 € | 49 779,83 € | 106 | Non établi |
| Tasty Crousty | 188 260,75 € | 89 428,11 € | 71 | Non établi |

Contrôle écran : la page authentifiée reste sur « Chargement éco-contribution » après 20 secondes ; résultats visuels non validés. Aucun changement de présentation effectué dans ce chantier.
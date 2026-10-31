# Transition parallèle — 31 octobre 2026

## Contrôles exécutés

- Source parallèle immutable, clé ligne unique ; l'ancien point d'entrée est également redirigé vers le staging, sans suppression automatique.
- Promotion réservée au service : exige preuve de complétude et concordance bidirectionnelle de chaque famille et signe. Les anciens enregistrements deviennent superseded, sans suppression.
- Les ajouts inédits sur un versement déjà basculé sont bloqués pour imposer un nouveau rapprochement.
- Vue security-invoker : source brute uniquement pour les versements explicitement promus, ancien import pour tous les autres. La page Éco-Contribution utilise cette source pour totaux, détails, évolution et exports ; le chargement des commandes brutes n'est plus nécessaire.
- Réimport réel API janvier Angers deux fois : 45 lignes, 45 clés uniques, total −1 085,79 €. Anciennes lignes et source effective strictement inchangées. Zéro erreur parseur.
- Utilisateur authentifié refusé sur staging et promotion (403).
- Écran authentifié Chicken Street 2026 chargé : 11 153,28 € remboursés, 24 698,80 € prélevés, net −13 545,52 €. Ces valeurs restent celles du classement historique, non certifiées.

## Matrice provisoire (tous ajustements, pas uniquement éco)

42 versements 2026 dans l'ancien import ; seulement 5 présents dans le rapport janvier reçu. Les autres sont « couverture API non établie », pas des manquants financiers confirmés.

| Versement | Ancien | Nouveau partiel | Delta | Cause |
|---|---:|---:|---:|---|
| MRJR1NQW4BLRFV6 | −183,01 | −114,11 | +68,90 | Anciennes lignes absentes du rapport partiel |
| 39VUKDTVFF6BHEJ | −407,72 | −407,72 | 0,00 | Concordant sur source reçue |
| U4NG5NXS6TSKO26 | −113,70 | −113,70 | 0,00 | Concordant sur source reçue |
| QCVTHJYKBVSHTUI | −91,83 | −91,83 | 0,00 | Classement TVA différent |
| AT1FJA8OCTPQD2T | −233,21 | −358,43 | −125,22 | Écart publicité et classement TVA différent |

Un changement de catégorie à montant égal est une différence de classement, pas deux faux manquants. Aucun versement n'a été promu faute de preuve de complétude. Aucun montant ne prouve à lui seul son caractère éco.

## Blocage des livrables suivants

PDF Angers source absent des justificatifs retrouvés ; les PDFs de versement identifiés concernent d'autres restaurants. Impossible de certifier a. En respectant l'ordre strict, le lot 10 restaurants b puis le réseau complet c ne sont pas lancés. La recette −118,08 €, la bascule et les soldes par enseigne restent non certifiés.

## Mise à jour — jalon 1 du 31 octobre, 11:07 UTC

18 rapports Angers demandés et reçus couvrent le 01/12/2025–31/10/2026. Les 464 lignes brutes ont 464 clés uniques. Deux réimports du rapport de mars laissent lignes brutes, anciens agrégats et vue effective strictement identiques ; aucun versement promu. Les deux fenêtres 2025 sont présentes en base, et 41 tests ciblés sont réussis.

Les 12 prélèvements de référence totalisent 1 226,46 € ; les 10 remboursements sont tous retrouvés sur la ligne source du 27/03/2026, versée le 30/03/2026, pour 1 108,38 €. Solde des 22 mouvements −118,08 €. Les périodes/volumes proviennent du document fourni ; aucun montant identique ne les certifie indépendamment.

Le checksum « autres paiements » 379,05 € est retrouvé sur dates de lignes 01/01–30/10/2026 en isolant publicité, marketing, TVA explicitement nommée et saisie-arrêt. Ne pas utiliser toutes les lignes non publicitaires ou la seule catégorie eco. Les 27 petits Autres frais totalisent 8,59 €, plutôt que 26/7,92 € dans le document ; ce détail et les retours titres-restaurant doivent être contre-vérifiés sans forcer le classement. La TVA explicitement nommée totalise séparément 8,61 € sur dates de lignes.

Le 02/02 : autres frais concordants −205,94 € (−108,09 −97,85), TVA +0,22 € concordante au montant ; publicité ancienne −27,49 €, API complète −207,25 € (−46,18 −25,38 −28,07 −28,68 −27,05 −27,49 −24,40). Le total complet −412,97 € remplace le total partiel −358,43 € dans le diagnostic, jamais dans la source ancienne ; delta complet −179,76 € entièrement publicitaire. Vue famille additive security-invoker, promotion détaillée inchangée ; lecture authentifiée vérifiée, outil SQL non authentifié refuse l'accès au helper comme attendu.

Fichiers de contre-vérification et matrice fournis. Lot 10 et réseau attendent la validation utilisateur de ce jalon ; PDF original toujours non examiné directement, bascule toujours non datée.
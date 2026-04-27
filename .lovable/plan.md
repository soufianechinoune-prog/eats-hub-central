Constat : le code appelle maintenant Uber avec le bon scope technique pour la connexion multi-restaurant, `eats.pos_provisioning`. Le log backend confirme que la dernière URL envoyée à Uber contient bien `scope=eats.pos_provisioning`. Donc le message actuel ne vient plus de l’ancien bug `eats.report` ; il signifie probablement que l’application Uber utilisée n’est pas encore autorisée/whitelistée par Uber pour ce scope de provisioning.

Plan proposé :

1. Rendre le diagnostic explicite dans l’interface
   - Remplacer le message générique actuel par un message clair : “Uber refuse le scope `eats.pos_provisioning`. Ce scope doit être activé côté Uber Developer / Uber Eats Marketplace pour cette application.”
   - Afficher l’erreur brute renvoyée par Uber si disponible (`error`, `error_description`) pour éviter de tourner en rond.

2. Ajouter une page/état de blocage propre
   - Si Uber renvoie `invalid_scope`, ne pas simplement rediriger en boucle.
   - Afficher une page avec :
     - le scope demandé,
     - le client/app concerné,
     - l’URL de redirection à vérifier,
     - la raison probable : scope non activé par Uber.

3. Corriger l’architecture d’auth Uber pour la suite
   - Garder deux flux séparés :
     - `authorization_code` + `eats.pos_provisioning` pour découvrir/activer les stores via login marchand ;
     - `client_credentials` + scopes app (`eats.store`, `eats.order`, `eats.report`, etc.) pour les opérations régulières après activation.
   - Ne pas mélanger les tokens utilisateur avec les tokens applicatifs.

4. Ajouter une fonction de test backend
   - Créer/ajouter un test de génération de token `client_credentials` pour confirmer quels scopes sont réellement disponibles sur l’app Uber.
   - L’objectif : savoir si Uber autorise au moins `eats.store` / `eats.report`, et isoler précisément le scope refusé.

5. Sécuriser le flux multi-restaurant
   - Continuer à utiliser `GET /v1/eats/stores` pour lister les restaurants avec le token `eats.pos_provisioning`.
   - Si Uber autorise le scope, rediriger vers la page de mapping multi-restaurants.
   - Si Uber refuse, afficher la marche à suivre côté Uber plutôt qu’une erreur bloquante incompréhensible.

Ce que ça veut dire fonctionnellement : le code est maintenant aligné avec la documentation Uber pour le flux multi-restaurant, mais Uber doit autoriser le scope `eats.pos_provisioning` sur l’application. Je peux maintenant améliorer le diagnostic et séparer proprement les deux types de tokens pour qu’on sache exactement ce qui bloque.
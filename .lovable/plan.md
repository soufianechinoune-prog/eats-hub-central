Plan de correction du flux “Connecter Uber Eats”

Objectif : quand tu cliques sur “Connecter Uber Eats”, tu dois pouvoir lancer une nouvelle tentative propre, idéalement arriver à l’écran Uber pour saisir/changer le compte, et ne plus rester bloqué par une ancienne tentative ou une URL OAuth incohérente.

1. Centraliser la redirection Uber
- Modifier le bouton restaurant pour ne plus construire directement l’URL `login.uber.com` dans le frontend.
- Utiliser systématiquement la fonction backend `uber-auth`, comme la page globale “Uber Connections”.
- Résultat : un seul endroit contrôle le `client_id`, le `redirect_uri`, le `scope` et le `state`.

2. Rendre chaque tentative unique
- Envoyer un `state` plus robuste, contenant :
  - le restaurant concerné,
  - un identifiant unique de tentative,
  - le timestamp.
- Objectif : éviter qu’une tentative précédente, par exemple Argenteuil, puisse être confondue avec une nouvelle tentative sur un autre restaurant.

3. Forcer une reconnexion / sélection de compte Uber quand possible
- Ajouter des paramètres OAuth de type `prompt=login` ou équivalent si Uber les accepte.
- Objectif : éviter que Uber réutilise silencieusement une session navigateur précédente.
- Si Uber ignore ce paramètre, le flux restera quand même propre côté application.

4. Adapter le callback Uber
- Le callback devra comprendre le nouveau `state` enrichi.
- Si le `state` contient un restaurant valide, enregistrer la connexion pour ce restaurant.
- Si le `state` est temporaire/global, conserver le comportement actuel vers la page de nomination.

5. Améliorer le message d’erreur
- Si Uber renvoie `invalid_scope`, afficher un message clair dans l’app :
  “Uber refuse l’autorisation demandée avant connexion. Ce n’est pas lié au restaurant sélectionné. Le scope demandé n’est probablement pas activé pour la connexion utilisateur.”
- Rediriger vers le restaurant d’origine plutôt que vers une page générique, quand on connaît le restaurant.

6. Ajouter une option de retentative claire
- Sur la carte “Connexion Uber Eats”, ajouter un bouton ou texte du type :
  “Réessayer avec un autre compte Uber”.
- Ce bouton relance une tentative fraîche, sans dépendre de l’état précédent.

Détails techniques
- Fichiers concernés :
  - `src/components/restaurants/UberConnectionSection.tsx`
  - `src/services/uberService.ts`
  - `src/pages/UberCallback.tsx`
  - `supabase/functions/uber-auth/index.ts`
- Pas de changement de structure de base de données nécessaire.
- Aucun token existant à nettoyer : la table `uber_connections` est actuellement vide.
- Le correctif ne garantit pas qu’Uber acceptera le scope `eats.report` en login utilisateur, mais il garantit un flux propre, retentable, non lié à Argenteuil, et avec des messages compréhensibles.
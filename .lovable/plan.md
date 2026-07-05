# Pourquoi Claude affiche « Authorization with the MCP server failed »

## Diagnostic

Tout le côté OAuth/MCP est correctement configuré côté app :
- MCP endpoint répond 401 avec le bon `WWW-Authenticate` et `resource_metadata`.
- Metadata `oauth-protected-resource` pointe bien sur l'issuer Supabase direct `https://akcicojkrzeirffefdet.supabase.co/auth/v1`.
- OpenID discovery + oauth-authorization-server exposent authorize, token, registration (DCR activé).
- Route `/.lovable/oauth/consent` est déployée en prod.
- URI allow-list inclut le domaine custom.

**Cause racine** : le JWKS du projet est vide :

```
GET /auth/v1/.well-known/jwks.json → { "keys": [] }
```

Cela veut dire que Supabase Auth signe encore les tokens en **HS256 (clé symétrique)**. Sans clé publique publiée dans le JWKS, `@lovable.dev/mcp-js` ne peut pas vérifier le bearer token émis pour Claude — donc toute autorisation échoue, quel que soit le client. C'est exactement le cas signalé dans la doc knowledge : *« Empty JWKS or symmetric-only signing blocks standards-based token verification. »*

Ce n'est **pas** un bug dans notre code MCP, notre page de consentement ou nos tools — c'est un réglage d'infrastructure Auth.

## Action

Migrer les clés de signature JWT du projet vers un algorithme **asymétrique** (RSA ou EdDSA) pour que le JWKS expose une clé publique.

Sur Lovable Cloud, cela se fait depuis le backend managé :

1. Ouvrir **Backend → Users → Auth settings (icône engrenage) → JWT signing keys**.
2. Créer une nouvelle clé asymétrique (ECC P-256 recommandé, ou RSA).
3. La promouvoir comme clé « current ».
4. Révoquer/retirer l'ancienne clé HS256 après quelques minutes.

Vérification côté agent après migration :

```
curl -s https://akcicojkrzeirffefdet.supabase.co/auth/v1/.well-known/jwks.json
```

Doit renvoyer au moins une clé (`kty: EC` ou `RSA`, `alg: ES256`/`RS256`, `kid` défini). Une fois JWKS peuplé, je re-teste la connexion Claude Code sans autre changement de code.

## Notes

- Aucun changement de code app n'est nécessaire — issuer, audience `authenticated`, DCR, page de consentement sont tous corrects.
- Cette bascule n'invalide pas les sessions utilisateurs actives (les tokens en cours restent valides jusqu'à expiration ; les prochains sont signés avec la nouvelle clé).
- Si l'écran « JWT signing keys » n'est pas exposé dans ton backend managé, il faut ouvrir un ticket support Lovable pour qu'ils déclenchent la migration côté projet — je ne peux pas la faire depuis l'agent.

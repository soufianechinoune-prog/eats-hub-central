Pour ouvrir la zone DNS de `cs-delivery-performance.com` chez Hostinger :

1. Va sur https://hpanel.hostinger.com et connecte-toi.
2. Dans le menu, ouvre **Domaines**.
3. Clique sur **cs-delivery-performance.com**.
4. Cherche **DNS / Nameservers** ou **Gérer les enregistrements DNS**.
5. Tu es alors dans la “zone DNS” du domaine.

Ensuite, dans cette zone DNS, il faut vérifier la ligne `notify` :

- S’il existe déjà un enregistrement `notify` en **A**, **CNAME**, **TXT**, **MX** ou autre, il peut bloquer la vérification : il faudra le supprimer s’il n’est pas demandé par Lovable.
- Il faut ajouter les enregistrements **NS** fournis par Lovable Cloud pour déléguer `notify.cs-delivery-performance.com`.
- Le nom/host doit généralement être `notify`, pas le domaine complet.
- La valeur doit être le serveur DNS indiqué par Lovable, par exemple un nameserver Lovable du type `ns...lovable.cloud`.

Dans Lovable :

1. Retourne dans **Cloud → Emails**.
2. Ouvre le menu du domaine `notify.cs-delivery-performance.com` si disponible.
3. Cherche les détails DNS attendus.
4. Copie exactement les valeurs NS affichées.
5. Ajoute-les chez Hostinger.
6. Clique ensuite sur **Verify Domain** dans Lovable Cloud.

Important : ne modifie pas les nameservers principaux du domaine `cs-delivery-performance.com`. Il faut uniquement déléguer le sous-domaine `notify` avec des enregistrements NS dans la zone DNS Hostinger.
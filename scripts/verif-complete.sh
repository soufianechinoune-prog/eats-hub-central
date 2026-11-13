#!/usr/bin/env bash
# Contrôle complet de Mijotek : installation, types, tests, build.
# Lovable gère les dépendances avec bun (bun.lock = référence ; package-lock.json est périmé).
# bun.lock pointe vers le cache privé de Lovable (pkg.dev), inaccessible ici :
# on réécrit TEMPORAIREMENT ces adresses vers le registre npm public (mêmes paquets,
# mêmes versions), on installe, puis on restaure le fichier d'origine.
set -uo pipefail
cd "$(dirname "$0")/.."
cp bun.lock /tmp/bun.lock.orig
sed -i -E "s#https://[a-z0-9-]+-npm\.pkg\.dev/lovable-core-prod/[^/]+/#https://registry.npmjs.org/#g" bun.lock
BUN_CONFIG_REGISTRY=https://registry.npmjs.org bun install --frozen-lockfile 2>&1 | tail -5
RC=${PIPESTATUS[0]}
cp /tmp/bun.lock.orig bun.lock
git checkout -q -- bun.lockb package-lock.json 2>/dev/null
[ "$RC" = 0 ] || { echo "ECHEC installation (code $RC)"; exit 1; }
echo "=== TYPES ==="; npx tsc --noEmit -p tsconfig.app.json > /tmp/tsc.log 2>&1; echo "tsc exit: $? — erreurs: $(grep -c 'error TS' /tmp/tsc.log)"
echo "=== TESTS ==="; npx vitest run 2>&1 | grep -E "Test Files|Tests |FAIL" | head -20
echo "=== BUILD ==="; npx vite build > /tmp/build.log 2>&1; echo "build exit: $?"; tail -3 /tmp/build.log

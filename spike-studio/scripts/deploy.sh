#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm install --no-audit --no-fund
npm --prefix functions install --no-audit --no-fund
npm run build
npx -y firebase-tools@latest deploy --project spike-studio-0361kr --only firestore:rules,functions:spike-studio:spikeApi,hosting

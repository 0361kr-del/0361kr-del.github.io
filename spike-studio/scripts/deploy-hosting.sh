#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# UI-only release: preserve deployed Functions, secrets, and Firestore rules.
npm install --no-audit --no-fund
npm run build
npx firebase deploy --project spike-studio-0361kr --only hosting

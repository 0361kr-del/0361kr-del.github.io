#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo '공용 참여 코드를 8~128자로 정하세요. OpenAI API 키와는 다른 값이어야 합니다.'
npx -y firebase-tools@latest functions:secrets:set SPIKE_ACCESS_CODE --project spike-studio-0361kr
bash scripts/deploy.sh

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project=spike-studio-0361kr
if [ "$(gcloud billing projects describe "$project" --format='value(billingEnabled)')" != "True" ]; then
  echo '먼저 Firebase Console에서 spike-studio-0361kr 프로젝트의 Blaze 요금제를 설정하세요.'
  exit 1
fi
gcloud services enable secretmanager.googleapis.com firestore.googleapis.com cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com eventarc.googleapis.com pubsub.googleapis.com --project="$project"
existing_db=$(gcloud firestore databases list --project="$project" --format='value(name)')
if ! printf '%s\n' "$existing_db" | grep -q '/(default)$'; then
 gcloud firestore databases create --database='(default)' --location=asia-northeast3 --type=firestore-native --project="$project"
fi
npx -y firebase-tools@latest apps:list WEB --project "$project" --json > /tmp/spike-apps.json
if node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync("/tmp/spike-apps.json","utf8"));process.exit(d.result?.length?1:0)'; then
 npx -y firebase-tools@latest apps:create WEB 'Spike Studio Web' --project "$project"
fi
echo '새로 발급한 OpenAI API 키를 아래 보안 입력란에 입력하세요. 입력은 화면에 표시되지 않습니다.'
npx -y firebase-tools@latest functions:secrets:set OPENAI_API_KEY --project "$project"
echo '공용 참여 코드를 8자 이상으로 정해 입력하세요. API 키와 다른 값을 사용하세요.'
npx -y firebase-tools@latest functions:secrets:set SPIKE_ACCESS_CODE --project "$project"
bash scripts/deploy.sh

#!/usr/bin/env bash
# Run in the project directory from an authenticated administrator's Cloud Shell.
set -euo pipefail
cd "$(dirname "$0")"
python3 - <<'PY'
from pathlib import Path
p=Path('.env.local')
s=Path('.env.example').read_text().replace('VITE_APP_MODE=demo','VITE_APP_MODE=firebase')
p.write_text(s)
p=Path('functions/.env.future-career-interview')
lines=p.read_text().splitlines() if p.exists() else []
# Preserve the administrator's existing student launch setting on redeploy.
student_setting=next((line for line in lines if line.startswith('STUDENT_AI_ENABLED=')), 'STUDENT_AI_ENABLED=false')
lines=[line for line in lines if not line.startswith(('STUDENT_AI_ENABLED=','OPENAI_TEACHER_PREVIEW_ENABLED='))]
lines+=[student_setting,'OPENAI_TEACHER_PREVIEW_ENABLED=true']
p.write_text('\n'.join(lines)+'\n')
PY
npm ci
npm --prefix functions ci
npm run build:functions
npm run build
npm test
npx -y firebase-tools@latest deploy --only functions:future-career:studentApi,functions:future-career:aiPreview,hosting --project future-career-interview

"""Read only the two boolean launch settings; never emit function metadata."""
import json
from pathlib import Path
import subprocess
p=Path('.env.example').read_text().replace('VITE_APP_MODE=demo','VITE_APP_MODE=firebase')
Path('.env.local').write_text(p)
def flag(function,key,default):
    raw=subprocess.check_output(['gcloud','functions','describe',function,'--gen2','--region=asia-northeast3','--project=future-career-interview','--format=json'],text=True)
    value=json.loads(raw).get('serviceConfig',{}).get('environmentVariables',{}).get(key,default)
    if value not in ['true','false']: raise SystemExit('Unexpected boolean value for '+key)
    return value
student=flag('studentApi','STUDENT_AI_ENABLED','false')
preview=flag('aiPreview','OPENAI_TEACHER_PREVIEW_ENABLED','false')
Path('functions/.env.future-career-interview').write_text(f'STUDENT_AI_ENABLED={student}\nOPENAI_TEACHER_PREVIEW_ENABLED={preview}\n')
print('Existing launch flags preserved; values and other metadata are not logged.')

"""Read recent operational metadata; output only aggregate codes, never raw logs or student content."""
import collections
import json
import subprocess
query='resource.type="cloud_run_revision" AND resource.labels.service_name="studentapi" AND severity>=WARNING'
r=subprocess.run(['gcloud','logging','read',query,'--project=future-career-interview','--freshness=2h','--limit=100','--format=json'],capture_output=True,text=True)
if r.returncode:
    print('DIAGNOSTICS_UNAVAILABLE: deployment identity could not read logs; raw output withheld.')
else:
    counts=collections.Counter()
    for row in json.loads(r.stdout):
        data=row.get('jsonPayload',{})
        status=row.get('httpRequest',{}).get('status')
        event=data.get('event')
        if event in ['student_api_internal','student_request_failed','student_ai_failed']:
            code=data.get('code','')
            if code in ['SAFE_INTERNAL_ERROR','unauthenticated','permission-denied','failed-precondition','invalid-input','domain-error','internal','AI_UNAVAILABLE','AI_REQUEST_REJECTED','AI_NETWORK_ERROR','AI_RATE_LIMIT']:counts[event+':'+code]+=1
            else:counts[event+':other']+=1
        elif isinstance(status,int):counts['http:'+str(status)]+=1
        else:
            text=json.dumps(data,ensure_ascii=False)+row.get('textPayload','')
            if 'AppCheck' in text or 'App Check' in text or 'app-check' in text:counts['app-check-warning']+=1
            else:counts['other-warning']+=1
    print('RECENT_STUDENT_ERROR_COUNTS '+json.dumps(dict(counts),sort_keys=True))

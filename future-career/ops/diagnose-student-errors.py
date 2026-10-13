"""Read recent operational metadata; output only aggregate codes, never raw logs or student content."""
import collections
import json
import subprocess
query='resource.type="cloud_run_revision" AND resource.labels.service_name="studentapi" AND severity>=WARNING'
r=subprocess.run(['gcloud','logging','read',query,'--project=future-career-interview','--freshness=24h','--limit=1000','--format=json'],capture_output=True,text=True)
if r.returncode:
    print('DIAGNOSTICS_UNAVAILABLE: deployment identity could not read logs; raw output withheld.')
else:
    from datetime import datetime
    rows=json.loads(r.stdout)
    target='c16a4e6c-032e-4902-99ba-b2b422384a96'
    def payload(row):
        data=row.get('jsonPayload',{})
        if not data:
            try: data=json.loads(row.get('textPayload','{}'))
            except (ValueError,TypeError): data={}
        return data if isinstance(data,dict) else {}
    matches=[row for row in rows if payload(row).get('requestId')==target]
    print('TARGET_REQUEST_MATCHES '+str(len(matches)))
    safe={'student_request_failed','student_ai_failed','student_api_internal'}
    for match in matches:
        when=datetime.fromisoformat(match['timestamp'].replace('Z','+00:00'))
        for row in rows:
            data=payload(row)
            if data.get('event') not in safe: continue
            stamp=datetime.fromisoformat(row['timestamp'].replace('Z','+00:00'))
            code=data.get('code','')
            import re
            if abs((stamp-when).total_seconds())<=5 and re.fullmatch(r'[A-Za-z_-]{1,60}',code):
                print('TARGET_NEARBY_EVENT '+json.dumps({'timestamp':row['timestamp'],'event':data['event'],'code':code,'exactRequest':data.get('requestId')==target}))
    counts=collections.Counter()
    for row in rows:
        data=payload(row)
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

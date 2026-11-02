"""One low-quality image probe. Secret stays in memory; never print image/base64 or key."""
import json, re, subprocess, urllib.request, urllib.error, sys
r=subprocess.run(['gcloud','secrets','versions','access','latest','--secret=OPENAI_API_KEY','--project=spike-studio-0361kr'],capture_output=True,text=True)
if r.returncode:
 print('SECRET_READ_FAILED: Cloud Shell 계정에 이 프로젝트의 API 키 읽기 권한이 필요합니다.');sys.exit(1)
key=r.stdout.strip()
if not key:
 print('EMPTY_KEY: 저장된 API 키가 비어 있습니다.');sys.exit(1)
body={'model':'gpt-image-1','prompt':'A simple volleyball on an indoor court, no people, no text. Background for a school volleyball poster.','size':'1024x1536','quality':'low','n':1}
req=urllib.request.Request('https://api.openai.com/v1/images/generations',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
def safe(value):
 text=str(value or '').replace(key,'[REDACTED]')
 return re.sub(r'sk-[A-Za-z0-9_-]+','[REDACTED]',text)[:1500]
try:
 with urllib.request.urlopen(req,timeout=160) as response:
  data=json.load(response)
  print(json.dumps({'status':response.status,'image_received':bool(data.get('data',[{}])[0].get('b64_json'))},ensure_ascii=False))
except urllib.error.HTTPError as error:
 try:data=json.loads(error.read()).get('error',{})
 except (ValueError,AttributeError):data={}
 print(json.dumps({'status':error.code,'code':safe(data.get('code')),'type':safe(data.get('type')),'param':safe(data.get('param')),'message':safe(data.get('message'))},ensure_ascii=False,indent=2))
except Exception:
 print('NETWORK_OR_RESPONSE_ERROR: 연결 시간 초과 또는 응답 처리 오류입니다. 키는 출력하지 않았습니다.')

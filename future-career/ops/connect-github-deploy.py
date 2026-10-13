#!/usr/bin/env python3
"""One-time project administrator setup in authenticated Google Cloud Shell.
Creates a dedicated keyless deploy identity. Never reads or exports secret values.
"""
import json
import subprocess

PROJECT = 'future-career-interview'
NUMBER = '16827856751'
REPO_ID = '1177991863'
OWNER_ID = '267077687'
POOL = 'career-github'
PROVIDER = 'github-deploy'
SA = f'career-github-deployer@{PROJECT}.iam.gserviceaccount.com'
MEMBER = f'serviceAccount:{SA}'
BRANCH = 'refs/heads/deploy/future-career'
WORKFLOW = '0361kr-del/0361kr-del.github.io/.github/workflows/future-career-deploy.yml@' + BRANCH
MAPPING = {'google.subject':'assertion.sub','attribute.repository_id':'assertion.repository_id','attribute.repository_owner_id':'assertion.repository_owner_id','attribute.ref':'assertion.ref','attribute.workflow_ref':'assertion.workflow_ref','attribute.event_name':'assertion.event_name'}
CONDITION = f"assertion.repository_id == '{REPO_ID}' && assertion.repository_owner_id == '{OWNER_ID}' && assertion.ref == '{BRANCH}' && assertion.workflow_ref == '{WORKFLOW}' && assertion.event_name == 'push'"

def read(*args):
    return json.loads(subprocess.check_output(['gcloud',*args,'--project='+PROJECT,'--format=json'],text=True))

def run(*args):
    subprocess.run(['gcloud',*args,'--project='+PROJECT,'--quiet'],check=True,stdout=subprocess.DEVNULL)

def main():
    if str(read('projects','describe',PROJECT)['projectNumber']) != NUMBER:
        raise SystemExit('Project number mismatch; stopped.')
    print('1/5 Enable identity federation APIs',flush=True)
    run('services','enable','iam.googleapis.com','iamcredentials.googleapis.com','sts.googleapis.com','cloudresourcemanager.googleapis.com')
    accounts=read('iam','service-accounts','list')
    if not any(a['email']==SA for a in accounts):
        run('iam','service-accounts','create','career-github-deployer','--display-name=Future career GitHub deploy only')
    print('2/5 Configure repository/branch/workflow restricted federation',flush=True)
    pools=read('iam','workload-identity-pools','list','--location=global')
    existing=next((p for p in pools if p['name'].endswith('/'+POOL)),None)
    if existing and (existing.get('state')!='ACTIVE' or existing.get('disabled')):
        raise SystemExit('Existing pool is disabled or inactive; stopped without changing it.')
    if not existing:
        run('iam','workload-identity-pools','create',POOL,'--location=global','--display-name=Future career GitHub')
    providers=read('iam','workload-identity-pools','providers','list','--location=global','--workload-identity-pool='+POOL)
    provider=next((p for p in providers if p['name'].endswith('/'+PROVIDER)),None)
    if provider:
        if provider.get('attributeCondition')!=CONDITION or provider.get('attributeMapping')!=MAPPING or provider.get('oidc',{}).get('issuerUri')!='https://token.actions.githubusercontent.com' or provider.get('disabled') or provider.get('state')!='ACTIVE':
            raise SystemExit('Existing provider differs; stopped without widening trust.')
    else:
        run('iam','workload-identity-pools','providers','create-oidc',PROVIDER,'--location=global','--workload-identity-pool='+POOL,'--issuer-uri=https://token.actions.githubusercontent.com','--attribute-mapping='+','.join(k+'='+v for k,v in MAPPING.items()),'--attribute-condition='+CONDITION)
    principal=f'principalSet://iam.googleapis.com/projects/{NUMBER}/locations/global/workloadIdentityPools/{POOL}/attribute.repository_id/{REPO_ID}'
    run('iam','service-accounts','add-iam-policy-binding',SA,'--member='+principal,'--role=roles/iam.workloadIdentityUser')
    print('3/5 Grant Firebase and existing function deployment permissions',flush=True)
    for role in ['roles/firebasehosting.admin','roles/cloudfunctions.developer','roles/firebase.viewer','roles/serviceusage.serviceUsageConsumer','roles/run.viewer','roles/artifactregistry.reader']:
        run('projects','add-iam-policy-binding',PROJECT,'--member='+MEMBER,'--role='+role,'--condition=None')
    for service in ['aipreview','studentapi']:
        run('run','services','add-iam-policy-binding',service,'--region=asia-northeast3','--member='+MEMBER,'--role=roles/run.admin')
    # Firebase CLI checks App Engine's default account where it exists. Runtime is Compute.
    accounts=read('iam','service-accounts','list')
    known={a['email'] for a in accounts}
    required={f'{NUMBER}-compute@developer.gserviceaccount.com'}
    for function in ['aiPreview','studentApi']:
        f=read('functions','describe',function,'--gen2','--region=asia-northeast3')
        for sa in [f.get('serviceConfig',{}).get('serviceAccountEmail'),f.get('buildConfig',{}).get('serviceAccount')]:
            if sa: required.add(sa.rsplit('/',1)[-1])
    if f'{PROJECT}@appspot.gserviceaccount.com' in known: required.add(f'{PROJECT}@appspot.gserviceaccount.com')
    for sa in sorted(required):
        run('iam','service-accounts','add-iam-policy-binding',sa,'--member='+MEMBER,'--role=roles/iam.serviceAccountUser')
    print('4/5 Allow metadata inspection of the two existing secrets',flush=True)
    for secret in ['OPENAI_API_KEY','ACCESS_CODE_PEPPER']:
        run('secrets','add-iam-policy-binding',secret,'--member='+MEMBER,'--role=roles/secretmanager.viewer')
        # Existing runtime access is made explicit; no value is read or copied.
        run('secrets','add-iam-policy-binding',secret,'--member=serviceAccount:'+NUMBER+'-compute@developer.gserviceaccount.com','--role=roles/secretmanager.secretAccessor')
    print('5/5 CONNECTION_READY: Google Cloud permissions configured. Ask Codex to start the first GitHub deployment.',flush=True)

if __name__ == '__main__': main()

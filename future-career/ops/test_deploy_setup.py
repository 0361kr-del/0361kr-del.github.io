import contextlib
import importlib.util
import io
import json
from pathlib import Path
import os
import runpy
import tempfile
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('connect',ROOT/'connect-github-deploy.py')
connect=importlib.util.module_from_spec(spec)
spec.loader.exec_module(connect)
class SetupTests(unittest.TestCase):
    def metadata(self,*args):
        if args[:2]==('projects','describe'):return {'projectNumber':connect.NUMBER}
        if args[:3]==('iam','service-accounts','list'):return [{'email':connect.SA}]
        if args[:3]==('iam','workload-identity-pools','list'):return [{'name':'projects/x/'+connect.POOL,'state':'ACTIVE'}]
        if args[:4]==('iam','workload-identity-pools','providers','list'):return [{'name':'x/'+connect.PROVIDER,'state':'ACTIVE','attributeCondition':connect.CONDITION,'attributeMapping':connect.MAPPING,'oidc':{'issuerUri':'https://token.actions.githubusercontent.com'}}]
        if args[:2]==('functions','describe'):return {}
        raise AssertionError(args)
    def test_existing_connection_is_not_recreated_and_permissions_are_scoped(self):
        with patch.object(connect,'read',side_effect=self.metadata),patch.object(connect,'run') as run,contextlib.redirect_stdout(io.StringIO()):connect.main()
        calls=[c.args for c in run.call_args_list]
        flat=json.dumps(calls)
        self.assertNotIn('create-oidc',flat)
        self.assertNotIn('roles/owner',flat)
        self.assertNotIn('roles/editor',flat)
        self.assertNotIn('keys',flat)
        self.assertIn('assertion.repository_id',connect.CONDITION)
        self.assertIn('assertion.workflow_ref',connect.CONDITION)
        self.assertIn('deploy/future-career',connect.CONDITION)
        for args in calls:
            if '--role=roles/secretmanager.secretAccessor' in args:self.assertNotIn('--member='+connect.MEMBER,args)
    def test_mismatched_existing_trust_stops(self):
        def read(*args):
            value=self.metadata(*args)
            if args[:4]==('iam','workload-identity-pools','providers','list'):value[0]['attributeCondition']='true'
            return value
        with patch.object(connect,'read',side_effect=read),patch.object(connect,'run') as run,contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit):connect.main()
        self.assertFalse(any('add-iam-policy-binding' in c.args for c in run.call_args_list))
    def test_ci_keeps_flags_and_does_not_copy_other_runtime_values(self):
        cwd=os.getcwd()
        with tempfile.TemporaryDirectory() as temp:
            try:
                os.chdir(temp);Path('functions').mkdir();Path('.env.example').write_text('VITE_APP_MODE=demo\n')
                raw=json.dumps({'serviceConfig':{'environmentVariables':{'STUDENT_AI_ENABLED':'true','OPENAI_TEACHER_PREVIEW_ENABLED':'false','PRIVATE_TEST_VALUE':'must-not-copy'}}})
                with patch('subprocess.check_output',return_value=raw),contextlib.redirect_stdout(io.StringIO()) as output:runpy.run_path(str(ROOT/'prepare-ci-env.py'))
                self.assertEqual(Path('functions/.env.future-career-interview').read_text(),'STUDENT_AI_ENABLED=true\nOPENAI_TEACHER_PREVIEW_ENABLED=false\n')
                self.assertNotIn('must-not-copy',output.getvalue())
                self.assertEqual(Path('.env.local').read_text(),'VITE_APP_MODE=firebase\n')
            finally:os.chdir(cwd)
if __name__=='__main__':unittest.main()

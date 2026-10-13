# Firebase GitHub deployment connection

Status: prepared and locally checked; Google Cloud bootstrap and end-to-end authenticated deployment have NOT been executed by Codex.

## One-time setup

An authenticated project administrator runs `python3 ops/connect-github-deploy.py` from the `future-career` directory in Cloud Shell. This enables federation APIs, creates the `career-github-deployer` service account and `career-github` pool/provider, and grants additive IAM bindings. It does not export keys or read secret payloads. If an existing provider has a different trust condition, the script stops rather than changing it. If setup partially fails, inspect the error and rerun after resolving that specific issue.

The user then reports `CONNECTION_READY`. Codex creates or advances `deploy/future-career` to the verified development commit using the existing GitHub connection. The root workflow `.github/workflows/future-career-deploy.yml` runs on pushes to that branch. No workflow-dispatch permission or default-branch change is required. Future deployment requests promote tested commits to this branch. This branch is a production deployment authority: anyone able to change it can deploy code. Development branch pushes and pull request code do not receive this federation credential.

## Trust and permissions

OIDC is restricted to numeric repository ID 1177991863, owner ID 267077687, branch `refs/heads/deploy/future-career`, this exact workflow path, and push events. The separate service account has Hosting Admin, Cloud Functions Developer, Firebase Viewer, Service Usage Consumer, Run Viewer and Artifact Registry Reader on `future-career-interview`. Run Admin is bound only to `aipreview` and `studentapi`. Service Account User is bound to the existing runtime/build accounts (plus App Engine default when present, for Firebase CLI compatibility). The two existing secrets grant this deployer metadata Viewer only; runtime Compute retains Secret Accessor. No Owner, Editor, service-account key or project-IAM-admin role is granted to GitHub.

Deploy permission and runtime impersonation allow the trusted branch to ship code that uses the application's data and secrets; this is real production authority. Bootstrap must therefore be run by the project administrator and the trust scope must not be broadened to pull requests, forks or arbitrary repositories.

## Pipeline and boundaries

Node 22 and Java 21; install; Functions build; unit and emulator tests; short-lived Google auth; fetch only existing student/teacher-preview booleans; production web build; deploy the two named functions and Hosting; verify Hosting HTTP response. Existing student access is preserved, not implicitly enabled or disabled. Firebase rules, data and unrelated GitHub Pages files are not deployment targets. Missing existing functions or insufficient IAM permissions cause failure; no automatic broad permission grant is performed.

Deployments serialize and do not cancel an in-progress deployment. Firebase function and Hosting deployment is not atomic, so inspect partial failures. Hosting HTTP 200 is not an end-to-end AI/auth test. GitHub Actions runs/logs must be checked after the first real invocation before claiming success. Permission propagation can take several minutes.

Disable the WIF provider to revoke future token exchange if needed. No credentials are copied into GitHub secrets. `ops/future-career-deploy.yml` is the source copy of the root workflow; update both together.

Local validation: Python compilation; 3 mock tests for trust mismatch, scoped bindings and launch-flag preservation; YAML parsing. No real Cloud IAM mutations were executed during these tests.

References:
- https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- https://github.com/google-github-actions/auth

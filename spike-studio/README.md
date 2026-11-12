# Spike Studio — Firebase deployment

Independent Firebase project: `spike-studio-0361kr`.
Frontend: Vite React/TypeScript. Server: Firebase Gen2 `spikeApi`, Seoul region.

## Setup
1. Link Blaze billing to the new project.
2. Choose a shared participation code of 8–128 characters, different from the API key.
3. From Cloud Shell with Firebase CLI and gcloud signed in, run `bash scripts/setup.sh`.
4. Enter the OpenAI key and SPIKE_ACCESS_CODE only in their separate Firebase secret prompts.
5. Visit the returned Hosting URL and enter the shared code. Google sign-in is not required.

The setup creates the default Firestore database only if absent, creates a web app if none exists, stores the OpenAI key in Secret Manager, and deploys only this project.
Firestore client access is denied. Server compares the shared code using SHA-256 and timing-safe comparison and validates request origin. Requests are limited to 60 per 10-minute window per hashed IP; no raw IP or code is logged. The browser keeps the code in sessionStorage until participation ends or the tab session ends. Rotating the server secret invalidates the old code on the next request. AI quotas are reserved transactionally before calls: 20 images / 100 text requests per UTC day, failures included. These are request limits, not a dollar budget. OpenAI model access and billing must be available. Images are returned to the browser, not stored on the server; templates/text persist in browser storage. Canvas image export and paid AI calls require live browser validation after setup.

## Verification
Local production frontend and Functions TypeScript builds. Live code verification, image generation, and deployment require Cloud Shell project credentials and the secret.

## Deploy again
`bash scripts/deploy.sh`

## Existing deployment: switch to shared code
Run `bash scripts/enable-shared-code.sh`. It creates a new secret version and deploys this project only. Use a new code to revoke the old one.

## 이미지 모델 수정 (2026-11-02)
종료된 `gpt-image-1`을 `gpt-image-2.5-flare`로 교체했습니다. Images API, low 품질, 1024x1536, 1장 및 일일 20회 제한을 유지합니다. 실제 계정의 이미지 생성은 배포 후 확인해야 합니다.

## Gallery sharing sync (2026-11-12)
Ported gallery sharing from Sites source commit `9463c8b55c142959680a9e4253d90057cce6afab`.
The current canvas is copied into an immutable submission snapshot, with a thumbnail, title, nickname, description and explicit publication consent. Submissions remain pending until a gallery administrator approves them. Retries reuse the submission ID.
The existing shared participation code, AI endpoints, manual/prompt modes and image generation animation remain in place. No API keys or server credentials are changed.

For this frontend-only update run `bash scripts/deploy-hosting.sh`. It deploys Hosting only; it does not redeploy Functions or Firestore rules.

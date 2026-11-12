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
Firestore client access is denied. Server compares the shared code using SHA-256 and timing-safe comparison and validates request origin. Only failed participation-code attempts are limited to 60 per 10-minute window per hashed IP; valid classroom participants are not IP-throttled. No raw IP or code is logged. The browser keeps the code in sessionStorage until participation ends or the tab session ends. Rotating the server secret invalidates the old code on the next request. Field testing has no application-level daily generation quotas. Atomic daily usage counters still count image/text attempts, including failures, for later quota planning. Provider quotas and server concurrency still apply. OpenAI model access and billing must be available. Images are returned to the browser, not stored on the server; templates/text persist in browser storage. Canvas image export and paid AI calls require live browser validation after setup.

## Verification
Local production frontend and Functions TypeScript builds. Live code verification, image generation, and deployment require Cloud Shell project credentials and the secret.

## Deploy again
`bash scripts/deploy.sh`

## Existing deployment: switch to shared code
Run `bash scripts/enable-shared-code.sh`. It creates a new secret version and deploys this project only. Use a new code to revoke the old one.

## 이미지 모델 수정 (2026-11-02)
종료된 `gpt-image-1`을 `gpt-image-2.5-flare`로 교체했습니다. Images API, low 품질, 1024x1536, 1장 설정을 유지합니다. 일일 생성 한도는 아래 필드 테스트 변경으로 해제되었습니다. 실제 계정의 이미지 생성은 배포 후 확인해야 합니다.

## Gallery sharing sync (2026-11-12)
Ported gallery sharing from Sites source commit `9463c8b55c142959680a9e4253d90057cce6afab`.
The current canvas is copied into an immutable submission snapshot, with a thumbnail, title, nickname, description and explicit publication consent. Submissions remain pending until a gallery administrator approves them. Retries reuse the submission ID.
The existing shared participation code, AI endpoints, manual/prompt modes and image generation animation remain in place. No API keys or server credentials are changed.

For this frontend-only update run `bash scripts/deploy-hosting.sh`. It deploys Hosting only; it does not redeploy Functions or Firestore rules.

## Prototype editor layout (2026-11-12)
The main entry now follows the supplied three-step design: background, draggable text, and send. Desktop uses a large canvas area plus a right tool panel; narrow screens place the tools below. Font, color, size, rotation, effects, alignment, undo/redo, local text autosave, PNG export and uploaded backgrounds are available. Existing `spike-draft` text is imported on first use; backgrounds are not persisted.
`src/editor-bridge.tsx` reuses the existing participation-code auth and `/api/generate` contract. Image generation still makes one request for one image. The existing `ShareToGallery` component receives the fully composed poster; consent, private pending submissions, and retry IDs remain unchanged. No Functions, API keys, gallery endpoint or review rules changed.
Validation: TypeScript and production build passed. Simulated-DOM tests covered prior draft import, step switching, AI adapter inputs, undo/redo, one-image result, background removal, composed-gallery handoff and local text save. Live visual/touch QA was unavailable because the managed preview relay was missing; real paid API generation was not repeated.

## Simplified background menu (2026-11-12)
Supersedes the initial draft-import behavior above: every page load starts with an empty poster; neither legacy drafts nor editor autosaves are automatically restored. Text presets create empty editable boxes. No saved records are explicitly deleted.
The default style is None, which sends no style instruction. The primary generation button is full-width and enlarged, with Clear background / Next below. Upload controls and thumbnail selection were removed; the one returned image is applied directly. Existing paid API, participation-code checks and gallery submission remain unchanged.
Validation: build/typecheck and simulated DOM tests passed for blank startup with legacy storage present, absent upload/thumbnail controls, exact unstyled prompt, styled prompt, undo/redo and composed gallery handoff.

## Classroom field test (2026-11-12)
Removed image 20/day and copy 100/day caps. Valid access codes bypass the shared-IP gate so a school NAT does not exhaust a class-wide allowance. Invalid codes remain throttled. Usage counters continue to track attempts, not successful results or billed cost.
Validation: Functions build and 7 mocked tests passed, including both generation kinds above their old caps and blocked IP state. No paid API request was used for tests.
Deploy Functions (Hosting-only deploy does not apply this change):
```bash
npm --prefix functions install --no-audit --no-fund
npm --prefix functions run build
node --test functions/*.test.mjs
npx -y firebase-tools@latest deploy --project spike-studio-0361kr --only functions:spike-studio:spikeApi
```

## Owner admin (2026-11-12)
`/admin.html` manages image and copy prompts and shows the latest 30 UTC daily request counters. The editor has an Administrator link. Saved prompts apply to subsequent requests; restore defaults populates the form and requires Save. Concurrent edits use a version check. API keys are never returned or edited in this UI.
Firebase Google sign-in is required for verified owner `0361kr@gmail.com`. Enable Google in Authentication → Sign-in method if not already enabled. The public Firebase web configuration is loaded from Hosting's `/__/firebase/init.json`; no OpenAI key is placed in the browser. Server verifies ID tokens (including revocation), email verification, owner email and Google provider on every admin read/write. Shared participation codes cannot access admin APIs. Firestore client rules remain deny-all; settings use server access only.
Deploy **Functions and Hosting**, not Hosting alone: `bash scripts/deploy.sh`. Admin settings default to the existing prompts when no settings document exists. Generation quotas remain removed. Image API uses a combined image prompt rather than a chat system role; copy generation uses the Responses instructions field plus mandatory JSON/length rules.
Validation: frontend and Functions builds passed; mocked tests cover owner authorization, missing/wrong identity, origin enforcement, invalid prompts and stale writes. Live Google login and paid generation require deployment credentials and were not exercised here.

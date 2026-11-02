# Spike Studio — Firebase deployment

Independent Firebase project: `spike-studio-0361kr`.
Frontend: Vite React/TypeScript. Server: Firebase Gen2 `spikeApi`, Seoul region.

## Setup
1. Link Blaze billing to the new project.
2. In Firebase Authentication, enable Google sign-in; support email `0361kr@gmail.com`.
3. From Cloud Shell with Firebase CLI and gcloud signed in, run `bash scripts/setup.sh`.
4. Enter the new OpenAI key only in the Firebase secret prompt.
5. Visit the returned Hosting URL and sign in as `0361kr@gmail.com`.

The setup creates the default Firestore database only if absent, creates a web app if none exists, stores the OpenAI key in Secret Manager, and deploys only this project.
Firestore client access is denied. Server verifies Firebase tokens, verified owner email, and request origin. AI quotas are reserved transactionally before calls: 20 images / 100 text requests per UTC day, failures included. These are request limits, not a dollar budget. OpenAI model access and billing must be available. Images are returned to the browser, not stored on the server; templates/text persist in browser storage. Canvas image export and paid AI calls require live browser validation after setup.

## Verification
Local production frontend and Functions TypeScript builds. Live authentication, image generation, and deployment require Cloud Shell project credentials and the secret.

## Deploy again
`bash scripts/deploy.sh`

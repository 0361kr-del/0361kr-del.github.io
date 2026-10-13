import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { aiSettingsSchema, type AiSettings } from '../../shared/ai-settings.js';
export const OWNER_UID = 'hUNsenuelrOlOqvHmYITwpoX2jx2';
export const isSiteOwner = (uid: string) => uid === OWNER_UID;
export async function getGlobalAi() {
  return aiSettingsSchema.parse((await getFirestore().doc('siteConfig/ai').get()).data()?.ai || {});
}
export function applyAiPolicy(input: unknown, global: AiSettings): AiSettings {
  const extra=aiSettingsSchema.parse(input || {});
  return {...extra,model:global.model,interviewSystemPrompt:global.interviewSystemPrompt,articleSystemPrompt:global.articleSystemPrompt};
}
export async function saveGlobalAi(uid: string, raw: unknown) {
  if(!isSiteOwner(uid))throw new HttpsError('permission-denied','ACCESS_DENIED');
  const ai=aiSettingsSchema.parse(raw);
  await getFirestore().doc('siteConfig/ai').set({ai,updatedBy:uid,updatedAt:Date.now()});
  return ai;
}

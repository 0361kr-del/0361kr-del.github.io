// Run only from an authenticated administrator's Cloud Shell.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
initializeApp({ projectId: 'future-career-interview' });
const account = await getAuth().getUserByEmail('0361kr@gmail.com');
if (account.disabled || !account.emailVerified || !account.providerData.some(p => p.providerId === 'google.com' && p.email === '0361kr@gmail.com')) {
  throw new Error('Verified Google teacher account required. Sign in on the AI test page first.');
}
await getFirestore().doc(`teachers/${account.uid}`).set({ active: true, approvedAt: FieldValue.serverTimestamp() }, { merge: true });
console.log('교사 승인 완료:', account.uid);

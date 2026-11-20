import { getFirestore } from 'firebase-admin/firestore';

// Test enrollment is open to verified Google sign-ins. The callable framework
// verifies the token; never accept identity/provider claims from request.data.
export async function enrollGoogleTeacher(uid: string, token: { firebase?: { sign_in_provider?: string }; email_verified?: boolean }) {
  const teacher = getFirestore().doc(`teachers/${uid}`);
  return getFirestore().runTransaction(async tx => {
    const existing = await tx.get(teacher);
    // Preserve explicit suspension and all existing approvals.
    if (existing.exists) return existing.data()?.active === true;
    if (token.firebase?.sign_in_provider !== 'google.com' || token.email_verified !== true) return false;
    tx.create(teacher, { active: true, enrollment: 'google-open-test', createdAt: Date.now() });
    return true;
  });
}

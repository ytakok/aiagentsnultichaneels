import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-agenthub';
const app = getApps()[0] ?? initializeApp({ projectId });
const auth = getAuth(app);
const firestore = getFirestore(app);
const email = 'inteliaiconsultancy@gmail.com';
const previousEmail = 'demo@agenthub.test';
const password = 'demo1234';

let user;
try {
  user = await auth.getUserByEmail(email);
} catch (error) {
  if (error.code !== 'auth/user-not-found') {
    throw error;
  }
  try {
    user = await auth.getUserByEmail(previousEmail);
  } catch (previousError) {
    if (previousError.code !== 'auth/user-not-found') {
      throw previousError;
    }
    user = undefined;
  }
}

if (user) {
  user = await auth.updateUser(user.uid, { email, password, emailVerified: true });
} else {
  user = await auth.createUser({ email, password, emailVerified: true });
}

await auth.setCustomUserClaims(user.uid, { tenantId: 'demo' });
const tenant = firestore.doc('tenants/demo');
await tenant.set(
  { displayName: 'Agent Hub Demo', createdAt: FieldValue.serverTimestamp() },
  { merge: true },
);
await tenant.collection('members').doc(user.uid).set({ role: 'owner' });

console.log(`Seeded ${email} for tenant demo in Firebase project ${projectId}.`);

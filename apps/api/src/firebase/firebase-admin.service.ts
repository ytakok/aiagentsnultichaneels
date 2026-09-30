import { Injectable } from '@nestjs/common';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirebaseAdminService {
  readonly app: App;
  readonly auth: Auth;
  readonly firestore: Firestore;

  constructor() {
    this.app =
      getApps()[0] ??
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-agenthub',
      });
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);
  }
}

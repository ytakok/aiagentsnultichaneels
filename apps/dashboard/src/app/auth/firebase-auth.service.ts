import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import {
  Auth,
  authState,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type UserCredential,
} from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private readonly injector = inject(Injector);
  private readonly auth = inject(Auth);
  readonly user = toSignal(authState(this.auth), { initialValue: null });

  signIn(email: string, password: string): Promise<UserCredential> {
    return runInInjectionContext(this.injector, () =>
      signInWithEmailAndPassword(this.auth, email, password),
    );
  }

  signOut(): Promise<void> {
    return runInInjectionContext(this.injector, () => firebaseSignOut(this.auth));
  }
}

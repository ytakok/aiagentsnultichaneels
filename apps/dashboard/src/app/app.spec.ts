import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';
import { FirebaseAuthService } from './auth/firebase-auth.service';

jest.mock('@angular/fire/auth', () => ({
  Auth: class Auth {},
  authState: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

function createFakeAuth() {
  return {
    user: signal<{ email: string } | null>(null),
    signIn: jest.fn(),
    signOut: jest.fn(),
  };
}

describe('App', () => {
  let fakeAuth: ReturnType<typeof createFakeAuth>;

  beforeEach(async () => {
    fakeAuth = createFakeAuth();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(appRoutes),
        {
          provide: FirebaseAuthService,
          useValue: fakeAuth,
        },
      ],
    }).compileComponents();
  });

  it('shows the login page when signed out', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-login')).not.toBeNull();
    expect(compiled.textContent).toContain('Welcome back');
  });

  it('calls the auth service when signing out', async () => {
    fakeAuth.user.set({ email: 'inteliaiconsultancy@gmail.com' });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button.sign-out').click();

    expect(fakeAuth.signOut).toHaveBeenCalled();
  });
});

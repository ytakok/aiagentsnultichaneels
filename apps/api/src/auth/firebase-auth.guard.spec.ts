import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import {
  AuthenticatedRequest,
  FirebaseAuthGuard,
} from './firebase-auth.guard';

const verifyIdToken = jest.fn<
  Promise<{ uid: string; tenantId?: unknown }>,
  [string]
>();
const firebase = {
  auth: { verifyIdToken },
} as unknown as FirebaseAdminService;

function makeContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    verifyIdToken.mockReset();
    guard = new FirebaseAuthGuard(firebase);
  });

  it('rejects requests without a bearer token', async () => {
    const request: AuthenticatedRequest = { headers: {} };

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('verifies the ID token and attaches the tenant identity', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1', tenantId: 'demo' });
    const request: AuthenticatedRequest = {
      headers: { authorization: 'Bearer valid-token' },
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual({ uid: 'user-1', tenantId: 'demo' });
  });

  it('rejects verified tokens without a tenant claim', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    const request: AuthenticatedRequest = {
      headers: { authorization: 'Bearer valid-token' },
    };

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

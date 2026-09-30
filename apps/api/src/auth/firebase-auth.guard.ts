import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

export interface AuthenticatedUser {
  uid: string;
  tenantId: string;
  email?: string;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  user?: AuthenticatedUser;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('A Firebase bearer token is required.');
    }

    try {
      const decoded = await this.firebase.auth.verifyIdToken(authorization.slice(7));
      const tenantId = decoded['tenantId'];
      if (typeof tenantId !== 'string' || tenantId.length === 0) {
        throw new UnauthorizedException('The Firebase user has no tenant claim.');
      }
      const email = decoded.email;
      request.user = {
        uid: decoded.uid,
        tenantId,
        ...(typeof email === 'string' ? { email } : {}),
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('The Firebase bearer token is invalid.');
    }
  }
}

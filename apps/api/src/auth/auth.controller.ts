import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard, type AuthenticatedRequest } from './firebase-auth.guard';

@Controller('auth')
@UseGuards(FirebaseAuthGuard)
export class AuthController {
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}

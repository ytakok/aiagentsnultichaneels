import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard';
import { GmailService } from './gmail.service';

@Controller('channels/gmail')
export class GmailController {
  constructor(private readonly gmail: GmailService) {}

  @Get('connect')
  @UseGuards(FirebaseAuthGuard)
  connect(@Req() request: AuthenticatedRequest) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      authorizationUrl: this.gmail.createAuthorizationUrl(user.tenantId, user.email),
    };
  }

  @Get('status')
  @UseGuards(FirebaseAuthGuard)
  status(@Req() request: AuthenticatedRequest) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.gmail.getConnectionStatus(user.tenantId);
  }

  @Get('messages')
  @UseGuards(FirebaseAuthGuard)
  messages(@Req() request: AuthenticatedRequest) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.gmail.getInboxMessages(user.tenantId);
  }

  @Get('oauth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') authorizationError: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:4200';
    if (authorizationError || !code || !state) {
      response.redirect(302, `${dashboardUrl}/channels?gmail=cancelled`);
      return;
    }

    try {
      await this.gmail.completeAuthorization(code, state);
      response.redirect(302, `${dashboardUrl}/channels?gmail=connected`);
    } catch (error) {
      const result = error instanceof UnauthorizedException ? 'account-mismatch' : 'error';
      response.redirect(302, `${dashboardUrl}/channels?gmail=${result}`);
    }
  }
}

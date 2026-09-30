import { Module } from '@nestjs/common';
import { FirebaseAdminModule } from '../firebase/firebase-admin.module';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';
import { GmailTokenStore } from './gmail-token.store';

@Module({
  imports: [FirebaseAdminModule],
  controllers: [GmailController],
  providers: [FirebaseAuthGuard, GmailService, GmailTokenStore],
})
export class ChannelsModule {}

import { Module } from '@nestjs/common';
import { FirebaseAdminModule } from '../firebase/firebase-admin.module';
import { AuthController } from './auth.controller';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Module({
  imports: [FirebaseAdminModule],
  controllers: [AuthController],
  providers: [FirebaseAuthGuard],
})
export class AuthModule {}

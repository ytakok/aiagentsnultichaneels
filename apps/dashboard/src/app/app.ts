import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { FirebaseAuthService } from './auth/firebase-auth.service';

@Component({
  imports: [LoginComponent, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly auth = inject(FirebaseAuthService);

  protected signOut(): void {
    void this.auth.signOut();
  }
}

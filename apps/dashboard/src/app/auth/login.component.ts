import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FirebaseAuthService } from './firebase-auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(FirebaseAuthService);
  protected readonly email = signal('inteliaiconsultancy@gmail.com');
  protected readonly password = signal('demo1234');
  protected readonly pending = signal(false);
  protected readonly errorMessage = signal('');

  protected async submit(): Promise<void> {
    this.pending.set(true);
    this.errorMessage.set('');
    try {
      await this.auth.signIn(this.email(), this.password());
    } catch {
      this.errorMessage.set('Sign-in failed. Check your credentials and emulator status.');
    } finally {
      this.pending.set(false);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import {
  GmailApiService,
  type GmailConnectionStatus,
} from './gmail-api.service';

@Component({
  selector: 'app-channels',
  imports: [MatButtonModule],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelsComponent implements OnInit {
  private readonly gmailApi = inject(GmailApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly status = signal<GmailConnectionStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly connecting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly resultMessage = signal('');

  ngOnInit(): void {
    const result = this.route.snapshot.queryParamMap.get('gmail');
    if (result === 'connected') {
      this.resultMessage.set('Gmail is connected. New messages will appear in the inbox.');
    } else if (result === 'account-mismatch') {
      this.errorMessage.set('Connect the Gmail account used to sign in to Agent Hub.');
    } else if (result === 'error') {
      this.errorMessage.set('Gmail authorization failed. Check OAuth settings and try again.');
    }
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.status.set(await this.gmailApi.getStatus());
      this.errorMessage.set('');
    } catch {
      this.errorMessage.set('Could not read Gmail connection status.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async connect(): Promise<void> {
    this.connecting.set(true);
    this.errorMessage.set('');
    try {
      await this.gmailApi.startConnect();
    } catch {
      this.errorMessage.set('Could not start Gmail authorization. Check the API and OAuth configuration.');
      this.connecting.set(false);
    }
  }
}

import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GmailApiService, type GmailInboxMessage } from '../channels/gmail-api.service';

@Component({
  selector: 'app-inbox',
  imports: [RouterLink],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxComponent implements OnInit, OnDestroy {
  private readonly gmailApi = inject(GmailApiService);
  private pollTimer?: ReturnType<typeof setInterval>;
  private refreshing = false;
  protected readonly conversations = signal<GmailInboxMessage[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    void this.refresh();
    this.pollTimer = setInterval(() => void this.refresh(), 5_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  protected retry(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    void this.refresh();
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) {
      return;
    }
    this.refreshing = true;
    try {
      this.conversations.set(await this.gmailApi.getInboxMessages());
      this.errorMessage.set('');
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not load the Gmail inbox.',
      );
    } finally {
      this.loading.set(false);
      this.refreshing = false;
    }
  }
}

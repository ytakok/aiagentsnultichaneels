import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FirebaseAuthService } from '../auth/firebase-auth.service';

export interface GmailConnectionStatus {
  configured: boolean;
  status: 'disconnected' | 'connected' | 'error';
  emailAddress?: string;
  lastPollAt?: string;
  lastError?: string;
}

export interface GmailInboxMessage {
  id: string;
  contactId: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unread: boolean;
  lastMessageSubject?: string;
}

@Injectable({ providedIn: 'root' })
export class GmailApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(FirebaseAuthService);
  private readonly baseUrl = 'http://localhost:3000/api/v1/channels/gmail';

  async getStatus(): Promise<GmailConnectionStatus> {
    return firstValueFrom(
      this.http.get<GmailConnectionStatus>(`${this.baseUrl}/status`, {
        headers: await this.authorizationHeaders(),
      }),
    );
  }

  async startConnect(): Promise<void> {
    const response = await firstValueFrom(
      this.http.get<{ authorizationUrl: string }>(`${this.baseUrl}/connect`, {
        headers: await this.authorizationHeaders(),
      }),
    );
    window.location.assign(response.authorizationUrl);
  }

  async getInboxMessages(): Promise<GmailInboxMessage[]> {
    return firstValueFrom(
      this.http.get<GmailInboxMessage[]>(`${this.baseUrl}/messages`, {
        headers: await this.authorizationHeaders(),
      }),
    );
  }

  private async authorizationHeaders(): Promise<HttpHeaders> {
    const user = this.auth.user();
    if (!user) {
      throw new Error('Sign in to Agent Hub before connecting Gmail.');
    }
    return new HttpHeaders({ Authorization: `Bearer ${await user.getIdToken()}` });
  }
}

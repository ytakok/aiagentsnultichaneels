import { google } from 'googleapis';
import type {
  ChannelContext,
  InboundMessage,
} from '@aiagentsnultichaneels/models';
import type { ChannelAdapter } from './channels';

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GmailCredentials {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string;
  id_token?: string | null;
  expiry_date?: number;
}

export interface GmailConnectionResult {
  emailAddress: string;
  historyId: string;
  credentials: GmailCredentials;
}

export interface GmailHistoryResult {
  messages: InboundMessage[];
  historyId: string;
  credentials: GmailCredentials;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeCredentials(credentials: {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  id_token?: string | null;
  expiry_date?: number | null;
}): GmailCredentials {
  return {
    ...(credentials.access_token !== undefined
      ? { access_token: credentials.access_token }
      : {}),
    ...(credentials.refresh_token !== undefined
      ? { refresh_token: credentials.refresh_token }
      : {}),
    ...(credentials.scope ? { scope: credentials.scope } : {}),
    ...(credentials.token_type ? { token_type: credentials.token_type } : {}),
    ...(credentials.id_token !== undefined ? { id_token: credentials.id_token } : {}),
    ...(typeof credentials.expiry_date === 'number'
      ? { expiry_date: credentials.expiry_date }
      : {}),
  };
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function extractBody(part: unknown): string {
  if (!isRecord(part)) {
    return '';
  }

  const mimeType = typeof part['mimeType'] === 'string' ? part['mimeType'] : '';
  const body = isRecord(part['body']) ? part['body'] : undefined;
  const data = body && typeof body['data'] === 'string' ? body['data'] : '';
  if (data && mimeType === 'text/plain') {
    return decodeBase64Url(data);
  }

  const parts = Array.isArray(part['parts']) ? part['parts'] : [];
  for (const child of parts) {
    const text = extractBody(child);
    if (text) {
      return text;
    }
  }

  if (data && mimeType === 'text/html') {
    return decodeBase64Url(data)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (!Array.isArray(headers)) {
    return undefined;
  }

  for (const header of headers) {
    if (
      isRecord(header) &&
      typeof header['name'] === 'string' &&
      header['name'].toLowerCase() === name.toLowerCase() &&
      typeof header['value'] === 'string'
    ) {
      return header['value'];
    }
  }

  return undefined;
}

function parseSender(value: string | undefined): { id: string; name?: string } {
  if (!value) {
    return { id: 'unknown' };
  }

  const match = /^(.*?)\s*<([^<>]+)>$/.exec(value.trim());
  if (!match) {
    return { id: value.trim() };
  }

  const name = match[1].trim().replace(/^"|"$/g, '');
  return name ? { id: match[2].trim(), name } : { id: match[2].trim() };
}

export class GmailAdapter implements ChannelAdapter {
  readonly type = 'gmail' as const;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
  ) {}

  verifyWebhook(): boolean {
    return false;
  }

  async parseInbound(payload: unknown, context: ChannelContext): Promise<InboundMessage[]> {
    if (!isRecord(payload)) {
      return [];
    }

    const providerMessageId = payload['id'];
    if (typeof providerMessageId !== 'string' || !providerMessageId) {
      return [];
    }

    const gmailPayload = isRecord(payload['payload']) ? payload['payload'] : {};
    const subject = headerValue(gmailPayload['headers'], 'subject');
    const sender = parseSender(headerValue(gmailPayload['headers'], 'from'));
    const internalDate = payload['internalDate'];
    const dateHeader = headerValue(gmailPayload['headers'], 'date');
    const receivedDate =
      typeof internalDate === 'string' || typeof internalDate === 'number'
        ? new Date(Number(internalDate))
        : dateHeader
          ? new Date(dateHeader)
          : new Date();
    const body = extractBody(gmailPayload) ||
      (typeof payload['snippet'] === 'string' ? payload['snippet'] : '');

    const message: InboundMessage = {
      ...context,
      providerMessageId,
      threadKey:
        typeof payload['threadId'] === 'string' ? payload['threadId'] : providerMessageId,
      from: sender,
      text: body,
      receivedAt: Number.isNaN(receivedDate.getTime())
        ? new Date().toISOString()
        : receivedDate.toISOString(),
      ...(subject ? { subject } : {}),
    };

    return [message];
  }

  async send(): Promise<{ providerMessageId: string }> {
    throw new Error('Gmail is configured as a read-only channel.');
  }

  createAuthorizationUrl(state: string, loginHint?: string): string {
    const oauth = this.createOAuthClient();
    return oauth.generateAuthUrl({
      access_type: 'offline',
      include_granted_scopes: true,
      prompt: 'consent',
      scope: [GMAIL_READONLY_SCOPE],
      state,
      ...(loginHint ? { login_hint: loginHint } : {}),
    });
  }

  async exchangeCode(code: string): Promise<GmailConnectionResult> {
    const oauth = this.createOAuthClient();
    const { tokens } = await oauth.getToken(code);
    oauth.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth });
    const { data } = await gmail.users.getProfile({ userId: 'me' });

    if (!data.emailAddress || !data.historyId) {
      throw new Error('Gmail did not return the connected account profile.');
    }

    return {
      emailAddress: data.emailAddress,
      historyId: data.historyId,
      credentials: normalizeCredentials(tokens),
    };
  }

  async pollHistory(
    credentials: GmailCredentials,
    startHistoryId: string,
    context: ChannelContext,
  ): Promise<GmailHistoryResult> {
    const oauth = this.createOAuthClient();
    oauth.setCredentials(credentials);
    const gmail = google.gmail({ version: 'v1', auth: oauth });
    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    let historyId = startHistoryId;

    do {
      const { data } = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        ...(pageToken ? { pageToken } : {}),
      });
      historyId = data.historyId ?? historyId;
      for (const history of data.history ?? []) {
        for (const added of history.messagesAdded ?? []) {
          if (added.message?.id) {
            messageIds.add(added.message.id);
          }
        }
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    const messages: InboundMessage[] = [];
    for (const id of messageIds) {
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      messages.push(...(await this.parseInbound(data, context)));
    }

    return {
      messages,
      historyId,
      credentials: normalizeCredentials(oauth.credentials),
    };
  }

  private createOAuthClient() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }
}
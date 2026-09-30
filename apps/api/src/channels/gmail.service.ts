import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  GmailAdapter,
} from '@aiagentsnultichaneels/channels';
import type { ChannelContext, InboundMessage } from '@aiagentsnultichaneels/models';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { GmailTokenStore, type StoredGmailConnection } from './gmail-token.store';

interface PendingAuthorization {
  tenantId: string;
  expectedEmail?: string;
  expiresAt: number;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Gmail polling failed.';
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  return error['code'] === 6 || error['code'] === 'already-exists';
}

@Injectable()
export class GmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GmailService.name);
  private readonly pendingAuthorizations = new Map<string, PendingAuthorization>();
  private pollTimer?: NodeJS.Timeout;
  private polling = false;

  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly tokenStore: GmailTokenStore,
  ) {}

  onModuleInit(): void {
    if (!this.isConfigured()) {
      this.logger.warn('Gmail polling disabled until GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are set.');
      return;
    }
    this.pollTimer = setInterval(() => void this.pollAll(), 60_000);
    void this.pollAll();
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  createAuthorizationUrl(tenantId: string, expectedEmail?: string): string {
    const state = randomBytes(32).toString('hex');
    this.pendingAuthorizations.set(state, {
      tenantId,
      ...(expectedEmail ? { expectedEmail } : {}),
      expiresAt: Date.now() + 10 * 60_000,
    });
    this.removeExpiredAuthorizations();
    return this.createAdapter().createAuthorizationUrl(state, expectedEmail);
  }

  async completeAuthorization(code: string, state: string): Promise<void> {
    const authorization = this.pendingAuthorizations.get(state);
    this.pendingAuthorizations.delete(state);
    if (!authorization || authorization.expiresAt < Date.now()) {
      throw new UnauthorizedException('The Gmail authorization state is invalid or expired.');
    }

    const result = await this.createAdapter().exchangeCode(code);
    if (
      authorization.expectedEmail &&
      result.emailAddress.toLowerCase() !== authorization.expectedEmail.toLowerCase()
    ) {
      throw new UnauthorizedException('Connect the Gmail account used to sign in to Agent Hub.');
    }

    const connection: StoredGmailConnection = {
      tenantId: authorization.tenantId,
      emailAddress: result.emailAddress,
      historyId: result.historyId,
      credentials: result.credentials,
      connectedAt: new Date().toISOString(),
    };
    await this.tokenStore.save(connection);
    await this.writeChannelStatus(authorization.tenantId, {
      type: 'gmail',
      displayName: result.emailAddress,
      status: 'connected',
      connectedAt: Timestamp.now(),
      historyId: result.historyId,
    });
    void this.pollConnection(connection);
  }

  async getConnectionStatus(tenantId: string): Promise<GmailConnectionStatus> {
    const connection = await this.tokenStore.get(tenantId);
    const channel = await this.tenantChannels(tenantId).doc('gmail').get();
    const data = channel.data();
    const status = data?.['status'];
    const lastPollAt = data?.['lastPollAt'];
    const lastError = data?.['lastError'];

    return {
      configured: this.isConfigured(),
      status:
        connection && status === 'error'
          ? 'error'
          : connection
            ? 'connected'
            : 'disconnected',
      ...(connection ? { emailAddress: connection.emailAddress } : {}),
      ...(lastPollAt instanceof Timestamp
        ? { lastPollAt: lastPollAt.toDate().toISOString() }
        : {}),
      ...(typeof lastError === 'string' ? { lastError } : {}),
    };
  }

  async getInboxMessages(tenantId: string): Promise<GmailInboxMessage[]> {
    const snapshot = await this.firebase.firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('conversations')
      .where('channelType', '==', 'gmail')
      .limit(50)
      .get();

    return snapshot.docs
      .map((document): GmailInboxMessage | undefined => {
        const data = document.data();
        const lastMessageAt = data['lastMessageAt'];
        if (
          typeof data['contactId'] !== 'string' ||
          typeof data['lastMessagePreview'] !== 'string' ||
          !(lastMessageAt instanceof Timestamp)
        ) {
          return undefined;
        }
        return {
          id: document.id,
          contactId: data['contactId'],
          lastMessagePreview: data['lastMessagePreview'],
          lastMessageAt: lastMessageAt.toDate().toISOString(),
          unread: data['unread'] === true,
          ...(typeof data['lastMessageSubject'] === 'string'
            ? { lastMessageSubject: data['lastMessageSubject'] }
            : {}),
        };
      })
      .filter((message): message is GmailInboxMessage => message !== undefined)
      .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
  }

  private async pollAll(): Promise<void> {
    if (this.polling || !this.isConfigured()) {
      return;
    }

    this.polling = true;
    try {
      const connections = await this.tokenStore.getAll();
      for (const connection of Object.values(connections)) {
        await this.pollConnection(connection);
      }
    } catch (error) {
      this.logger.error(`Unable to poll Gmail connections: ${errorMessage(error)}`);
    } finally {
      this.polling = false;
    }
  }

  private async pollConnection(connection: StoredGmailConnection): Promise<void> {
    try {
      const context: ChannelContext = {
        tenantId: connection.tenantId,
        channelId: 'gmail',
        channelType: 'gmail',
      };
      const result = await this.createAdapter().pollHistory(
        connection.credentials,
        connection.historyId,
        context,
      );
      for (const message of result.messages) {
        await this.saveInboundMessage(message);
      }

      const updatedConnection: StoredGmailConnection = {
        ...connection,
        historyId: result.historyId,
        credentials: result.credentials,
      };
      await this.tokenStore.save(updatedConnection);
      await this.writeChannelStatus(connection.tenantId, {
        status: 'connected',
        historyId: result.historyId,
        lastPollAt: FieldValue.serverTimestamp(),
        lastError: FieldValue.delete(),
      });
    } catch (error) {
      const message = errorMessage(error);
      this.logger.warn(`Gmail poll failed for tenant ${connection.tenantId}: ${message}`);
      await this.writeChannelStatus(connection.tenantId, {
        status: 'error',
        lastError: message.slice(0, 300),
        lastPollAt: FieldValue.serverTimestamp(),
      });
    }
  }

  private async saveInboundMessage(message: InboundMessage): Promise<void> {
    const tenant = this.firebase.firestore.collection('tenants').doc(message.tenantId);
    const conversationId = createHash('sha256')
      .update(message.threadKey)
      .digest('hex')
      .slice(0, 40);
    const messageId = `gmail_${message.providerMessageId}`.replace(/\//g, '_');
    const conversation = tenant.collection('conversations').doc(conversationId);
    const messageReference = conversation.collection('messages').doc(messageId);
    const receivedAt = new Date(message.receivedAt);

    try {
      await messageReference.create({
        direction: 'inbound',
        text: message.text,
        from: message.from,
        receivedAt: message.receivedAt,
        ...(message.subject ? { subject: message.subject } : {}),
      });
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        return;
      }
      throw error;
    }

    await this.firebase.firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(conversation);
      const labels = existing.exists && Array.isArray(existing.get('labels'))
        ? existing.get('labels') as string[]
        : [];
      transaction.set(
        conversation,
        {
          channelId: 'gmail',
          channelType: 'gmail',
          threadKey: message.threadKey,
          contactId: message.from.id,
          lastMessageAt: Timestamp.fromDate(receivedAt),
          lastMessagePreview: message.text.slice(0, 240),
          ...(message.subject ? { lastMessageSubject: message.subject } : {}),
          labels,
          unread: true,
        },
        { merge: true },
      );
    });
  }

  private async writeChannelStatus(
    tenantId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.tenantChannels(tenantId).doc('gmail').set(data, { merge: true });
  }

  private tenantChannels(tenantId: string) {
    return this.firebase.firestore.collection('tenants').doc(tenantId).collection('channels');
  }

  private isConfigured(): boolean {
    return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
  }

  private createAdapter(): GmailAdapter {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in the local .env file.',
      );
    }

    const redirectUri =
      process.env.GMAIL_REDIRECT_URI ??
      'http://localhost:3000/api/v1/channels/gmail/oauth/callback';
    return new GmailAdapter(clientId, clientSecret, redirectUri);
  }

  private removeExpiredAuthorizations(): void {
    const currentTime = Date.now();
    for (const [state, pending] of this.pendingAuthorizations) {
      if (pending.expiresAt < currentTime) {
        this.pendingAuthorizations.delete(state);
      }
    }
  }
}

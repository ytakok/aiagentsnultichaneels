import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { GmailCredentials } from '@aiagentsnultichaneels/channels';

export interface StoredGmailConnection {
  tenantId: string;
  emailAddress: string;
  historyId: string;
  credentials: GmailCredentials;
  connectedAt: string;
}

@Injectable()
export class GmailTokenStore {
  private readonly filePath = this.resolveFilePath();

  async getAll(): Promise<Record<string, StoredGmailConnection>> {
    try {
      const contents = await readFile(this.filePath, 'utf8');
      return JSON.parse(contents) as Record<string, StoredGmailConnection>;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async get(tenantId: string): Promise<StoredGmailConnection | undefined> {
    const connections = await this.getAll();
    return connections[tenantId];
  }

  async save(connection: StoredGmailConnection): Promise<void> {
    const connections = await this.getAll();
    connections[connection.tenantId] = connection;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(connections, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  private resolveFilePath(): string {
    const configuredPath = process.env.GMAIL_TOKENS_PATH ?? '.local/gmail-tokens.json';
    return isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);
  }
}

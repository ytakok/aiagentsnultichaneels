import { GmailAdapter } from './gmail.adapter';

const context = {
  tenantId: 'demo',
  channelId: 'gmail',
  channelType: 'gmail' as const,
};

describe('GmailAdapter', () => {
  const adapter = new GmailAdapter('client-id', 'client-secret', 'http://localhost/callback');

  it('normalizes Gmail headers, MIME text, thread and received time', async () => {
    const payload = {
      id: 'provider-message-1',
      threadId: 'thread-1',
      internalDate: '1790586000000',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'From', value: 'Ada Example <ada@example.com>' },
          { name: 'Subject', value: 'Invoice attached' },
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: Buffer.from('Please review the invoice').toString('base64url') },
          },
        ],
      },
    };

    await expect(adapter.parseInbound(payload, context)).resolves.toEqual([
      {
        ...context,
        providerMessageId: 'provider-message-1',
        threadKey: 'thread-1',
        from: { id: 'ada@example.com', name: 'Ada Example' },
        subject: 'Invoice attached',
        text: 'Please review the invoice',
        receivedAt: new Date(1790586000000).toISOString(),
      },
    ]);
  });

  it('requests only the Gmail read-only scope', () => {
    const url = new URL(adapter.createAuthorizationUrl('state-1', 'ada@example.com'));

    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/gmail.readonly',
    );
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('login_hint')).toBe('ada@example.com');
  });

  it('does not support outbound Gmail messages', async () => {
    await expect(
      adapter.send(
        {
          tenantId: 'demo',
          channelId: 'gmail',
          channelType: 'gmail',
          recipientId: 'ada@example.com',
          text: 'Hello',
        },
        context,
      ),
    ).rejects.toThrow('read-only');
  });
});

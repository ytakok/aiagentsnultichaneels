import { inboundMessageSchema } from './models';

describe('inboundMessageSchema', () => {
  it('accepts normalized simulator messages', () => {
    expect(
      inboundMessageSchema.safeParse({
        tenantId: 'demo',
        channelId: 'simulator',
        channelType: 'simulator',
        providerMessageId: 'message-1',
        threadKey: 'thread-1',
        from: { id: 'sender@example.test' },
        text: 'Hello',
        receivedAt: '2026-09-28T09:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('rejects unknown channel types', () => {
    expect(
      inboundMessageSchema.safeParse({
        tenantId: 'demo',
        channelId: 'other',
        channelType: 'other',
        providerMessageId: 'message-1',
        threadKey: 'thread-1',
        from: { id: 'sender@example.test' },
        text: 'Hello',
        receivedAt: '2026-09-28T09:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

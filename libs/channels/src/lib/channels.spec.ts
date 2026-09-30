import { ChannelAdapter } from './channels';

describe('ChannelAdapter', () => {
  it('defines the shared adapter contract', async () => {
    const adapter: ChannelAdapter = {
      type: 'simulator',
      verifyWebhook: () => true,
      parseInbound: async () => [],
      send: async () => ({ providerMessageId: 'sent-1' }),
    };

    await expect(adapter.send({
      tenantId: 'demo',
      channelId: 'simulator',
      channelType: 'simulator',
      recipientId: 'sender-1',
      text: 'Hello',
    }, {
      tenantId: 'demo',
      channelId: 'simulator',
      channelType: 'simulator',
    })).resolves.toEqual({ providerMessageId: 'sent-1' });
  });
});

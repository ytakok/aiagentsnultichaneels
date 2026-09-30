import type {
  ChannelContext,
  ChannelType,
  InboundMessage,
  OutboundMessage,
} from '@aiagentsnultichaneels/models';

export interface ChannelAdapter {
  type: ChannelType;
  verifyWebhook(req: { headers: Record<string, string>; rawBody: Buffer }): boolean;
  parseInbound(payload: unknown, ctx: ChannelContext): Promise<InboundMessage[]>;
  send(
    msg: OutboundMessage,
    ctx: ChannelContext,
  ): Promise<{ providerMessageId: string }>;
}

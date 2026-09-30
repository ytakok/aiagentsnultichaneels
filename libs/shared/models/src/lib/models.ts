import { z } from 'zod';

export const channelTypes = ['gmail', 'whatsapp', 'simulator'] as const;
export type ChannelType = (typeof channelTypes)[number];

export const inboundMessageSchema = z.object({
  tenantId: z.string().min(1),
  channelId: z.string().min(1),
  channelType: z.enum(channelTypes),
  providerMessageId: z.string().min(1),
  threadKey: z.string().min(1),
  from: z.object({
    id: z.string().min(1),
    name: z.string().optional(),
  }),
  text: z.string(),
  subject: z.string().optional(),
  receivedAt: z.string().datetime({ offset: true }),
});

export interface InboundMessage {
  tenantId: string;
  channelId: string;
  channelType: ChannelType;
  providerMessageId: string;
  threadKey: string;
  from: { id: string; name?: string };
  text: string;
  subject?: string;
  receivedAt: string;
}

export interface OutboundMessage {
  tenantId: string;
  channelId: string;
  channelType: ChannelType;
  recipientId: string;
  text: string;
}

export interface ChannelContext {
  tenantId: string;
  channelId: string;
  channelType: ChannelType;
}

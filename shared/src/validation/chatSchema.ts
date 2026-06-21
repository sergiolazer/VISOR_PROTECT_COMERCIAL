import { z } from 'zod';

export const joinConversationSchema = z.object({
  conversation_id: z.string().uuid(),
});

export const sendMessageSchema = z
  .object({
    conversation_id: z.string().uuid(),
    text: z.string().max(2000).optional(),
    image_url: z.string().url().optional(),
  })
  .refine(
    (data) => Boolean(data.text?.trim()) || Boolean(data.image_url),
    { message: 'El mensaje debe incluir texto o una imagen' },
  );

export const messageSeenSchema = z.object({
  conversation_id: z.string().uuid(),
  message_id: z.string().uuid(),
});

export const createDirectConversationSchema = z.object({
  target_shop_id: z.string().uuid(),
});

export type JoinConversationInput = z.infer<typeof joinConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageSeenInput = z.infer<typeof messageSeenSchema>;
export type CreateDirectConversationInput = z.infer<typeof createDirectConversationSchema>;

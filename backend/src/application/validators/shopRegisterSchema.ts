import { z } from 'zod';

const shopRegisterSchema = z.object({
  shop_id: z.string().uuid('shop_id debe ser un UUID válido'),
});

export type ShopRegisterPayload = z.infer<typeof shopRegisterSchema>;

export function parseShopRegisterPayload(data: unknown): ShopRegisterPayload {
  return shopRegisterSchema.parse(data);
}

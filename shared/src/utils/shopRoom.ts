import { SHOP_ROOM_PREFIX } from '../constants/alertDispatch';

export function getShopRoomName(shopId: string, prefix = SHOP_ROOM_PREFIX): string {
  return `${prefix}${shopId}`;
}

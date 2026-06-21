import type { ReelService } from '../ReelService';
import type { SecureEventService } from '../SecureEventService';
import type { AlertService } from '../AlertService';
import type { ChatService } from '../ChatService';
import type { ShopContextService } from '../ShopContextService';
import type { ICityRoomService } from '../../../domain/services/ICityRoomService';
import type { IShopRepository } from '../../../domain/repositories/IShopRepository';
import type { AlertSenderValidator } from '../../validators/AlertSenderValidator';

export interface SocketHandlerDependencies {
  secureEventService: SecureEventService;
  reelService: ReelService;
  alertService: AlertService;
  chatService: ChatService;
  cityRoomService: ICityRoomService;
  shopRepository: IShopRepository;
  alertSenderValidator: AlertSenderValidator;
  shopContextService: ShopContextService;
}

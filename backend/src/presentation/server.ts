import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from '../config/env';
import { validateProductionConfig } from '../config/validateProductionConfig';
import { connectMongoDB, disconnectMongoDB, isMongoConnected } from '../infrastructure/database/mongodb/connection';
import { syncMongoIndexes } from '../infrastructure/database/mongodb/syncIndexes';
import { MongoShopRepository } from '../infrastructure/database/mongodb/repositories/MongoShopRepository';
import { MongoEventLogRepository } from '../infrastructure/database/mongodb/repositories/MongoEventLogRepository';
import { MongoUserRepository } from '../infrastructure/database/mongodb/repositories/MongoUserRepository';
import { CityRoomService } from '../application/services/CityRoomService';
import { ReelService } from '../application/services/ReelService';
import { SecureEventService } from '../application/services/SecureEventService';
import { ShopContextService } from '../application/services/ShopContextService';
import { EventChangeStreamService } from '../application/services/EventChangeStreamService';
import { SubscriptionService } from '../application/services/SubscriptionService';
import { AuthService } from '../application/services/AuthService';
import { AlertSenderValidator } from '../application/validators/AlertSenderValidator';
import { AuthController } from '../presentation/controllers/authController';
import { ChatController } from '../presentation/controllers/chatController';
import { createAuthRouter } from '../presentation/routes/authRoutes';
import { createChatRouter, createMessagesRouter } from '../presentation/routes/chatRoutes';
import { ChatService } from '../application/services/ChatService';
import { ImageUrlValidator } from '../application/services/ImageUrlValidator';
import { MediaAccessService } from '../application/services/MediaAccessService';
import { UploadController } from '../presentation/controllers/uploadController';
import { MediaController } from '../presentation/controllers/mediaController';
import { createUploadRouter, createMediaRouter } from '../presentation/routes/uploadRoutes';
import { createImageStorageService } from '../infrastructure/storage/createImageStorageService';
import { ChatExportService } from '../application/services/ChatExportService';
import { MongoAuditLogRepository } from '../infrastructure/database/mongodb/repositories/MongoAuditLogRepository';
import { MongoConversationRepository } from '../infrastructure/database/mongodb/repositories/MongoConversationRepository';
import { MongoMessageRepository } from '../infrastructure/database/mongodb/repositories/MongoMessageRepository';
import { createSocketServer } from '../infrastructure/socket/SocketServer';
import { AlertDispatchService } from '../application/services/AlertDispatchService';
import { GeofenceService } from '../application/services/GeofenceService';
import { AlertService } from '../application/services/AlertService';
import { AlertBroadcastService } from '../application/services/AlertBroadcastService';
import { AlertDescriptionValidator } from '../application/validators/AlertDescriptionValidator';
import { AlertFilterTelemetryService } from '../application/services/AlertFilterTelemetryService';
import { MongoAlertEventRepository } from '../infrastructure/database/mongodb/repositories/MongoAlertEventRepository';
import { MongoAlertRecipientRepository } from '../infrastructure/database/mongodb/repositories/MongoAlertRecipientRepository';
import { createAlertBroker } from '../infrastructure/redis/createAlertBroker';
import { registerAllSocketHandlers } from '../application/services/socketHandlers';
import { MercadoPagoBillingService } from '../infrastructure/billing/MercadoPagoBillingService';
import { BillingWebhookService } from '../application/services/BillingWebhookService';
import { BillingController } from '../presentation/controllers/billingController';
import { createBillingRouter, createBillingWebhookRouter } from '../presentation/routes/billingRoutes';

async function bootstrap(): Promise<void> {
  validateProductionConfig();
  await connectMongoDB();
  await syncMongoIndexes();

  const app = express();
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  const shopRepository = new MongoShopRepository();
  const eventLogRepository = new MongoEventLogRepository();
  const userRepository = new MongoUserRepository();
  const auditLogRepository = new MongoAuditLogRepository();
  const subscriptionService = new SubscriptionService(shopRepository, auditLogRepository);
  const authService = new AuthService(userRepository, shopRepository, subscriptionService);
  const authController = new AuthController(authService);

  const mercadoPagoBilling = new MercadoPagoBillingService();
  const billingWebhookService = new BillingWebhookService(mercadoPagoBilling, subscriptionService);
  const billingController = new BillingController(
    authService,
    mercadoPagoBilling,
    billingWebhookService,
    shopRepository,
  );

  const conversationRepository = new MongoConversationRepository();
  const messageRepository = new MongoMessageRepository();
  const imageUrlValidator = new ImageUrlValidator(env.trustedImageDomains);
  const mediaAccessService = new MediaAccessService();
  const imageStorageService = createImageStorageService(mediaAccessService);
  const uploadController = new UploadController(imageStorageService);
  const mediaController = new MediaController(mediaAccessService);
  const chatService = new ChatService(
    conversationRepository,
    messageRepository,
    shopRepository,
    imageUrlValidator,
  );
  const chatExportService = new ChatExportService(
    conversationRepository,
    messageRepository,
    auditLogRepository,
  );
  const chatController = new ChatController(chatService, chatExportService, authService);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'visor-protect-backend',
      database: isMongoConnected() ? 'mongodb_connected' : 'mongodb_disconnected',
      alert_broker: env.redisEnabled ? 'redis' : 'in_process',
    });
  });

  app.use('/api/auth', createAuthRouter(authService, authController));
  app.use('/api/billing/webhook', createBillingWebhookRouter(billingController));
  app.use('/api/billing', createBillingRouter(authService, billingController));
  app.use('/api', createUploadRouter(authService, uploadController));
  app.use('/api/media', createMediaRouter(mediaController));
  app.use('/api/chat', createChatRouter(authService, chatController));
  app.use('/api/messages', createMessagesRouter(authService, chatController));

  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer, authService, shopRepository);

  const { broker: alertBroker, cleanup: cleanupAlertBroker } = await createAlertBroker();
  const geofenceService = new GeofenceService(shopRepository);
  const alertDispatchService = new AlertDispatchService(
    io,
    alertBroker,
    geofenceService,
    env.instanceId || undefined,
  );
  await alertDispatchService.start();

  const alertSenderValidator = new AlertSenderValidator(shopRepository);
  const cityRoomService = new CityRoomService(io);
  const shopContextService = new ShopContextService((id) => shopRepository.findById(id));

  const alertEventRepository = new MongoAlertEventRepository();
  const alertRecipientRepository = new MongoAlertRecipientRepository();
  const alertFilterTelemetry = new AlertFilterTelemetryService();
  const alertBroadcastService = new AlertBroadcastService(
    alertRecipientRepository,
    alertDispatchService,
    alertFilterTelemetry,
  );
  const alertService = new AlertService(
    alertEventRepository,
    eventLogRepository,
    shopRepository,
    alertBroadcastService,
    alertRecipientRepository,
    alertFilterTelemetry,
    new AlertDescriptionValidator(),
    subscriptionService,
    auditLogRepository,
  );

  const secureEventService = new SecureEventService(alertService, shopContextService);
  const reelService = new ReelService(
    eventLogRepository,
    cityRoomService,
    alertDispatchService,
    alertSenderValidator,
  );

  const changeStreamService = new EventChangeStreamService(alertService);
  if (env.mongoChangeStream) {
    changeStreamService.start();
  }

  registerAllSocketHandlers(io, {
    secureEventService,
    reelService,
    alertService,
    chatService,
    cityRoomService,
    shopRepository,
    alertSenderValidator,
    shopContextService,
  });

  httpServer.listen(env.port, () => {
    console.log(`[Server] Visor Protect backend — puerto ${env.port}`);
    console.log('[Server] JWT + MongoDB Atlas | POST /api/auth/login');
  });

  const shutdown = async (signal: string) => {
    console.log(`[Server] Recibido ${signal}, cerrando...`);
    await changeStreamService.stop();
    await alertDispatchService.stop();
    await cleanupAlertBroker();
    io.close();
    httpServer.close();
    await disconnectMongoDB();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('[Server] Error fatal al iniciar:', error);
  process.exit(1);
});

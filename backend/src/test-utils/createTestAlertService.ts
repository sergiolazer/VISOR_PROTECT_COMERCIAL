import { AlertBroadcastService } from '../application/services/AlertBroadcastService';
import { AlertService } from '../application/services/AlertService';
import { CityRoomService } from '../application/services/CityRoomService';
import { AlertDescriptionValidator } from '../application/validators/AlertDescriptionValidator';
import { AlertFilterTelemetryService } from '../application/services/AlertFilterTelemetryService';
import { SubscriptionService } from '../application/services/SubscriptionService';
import { MongoAlertEventRepository } from '../infrastructure/database/mongodb/repositories/MongoAlertEventRepository';
import { MongoAlertRecipientRepository } from '../infrastructure/database/mongodb/repositories/MongoAlertRecipientRepository';
import { MongoAuditLogRepository } from '../infrastructure/database/mongodb/repositories/MongoAuditLogRepository';
import { MongoEventLogRepository } from '../infrastructure/database/mongodb/repositories/MongoEventLogRepository';
import type { AlertTestHarness } from './alertTestHarness';

export function createTestAlertService(harness: AlertTestHarness) {
  const recipientRepository = new MongoAlertRecipientRepository();
  const filterTelemetry = new AlertFilterTelemetryService();
  const auditLogRepository = new MongoAuditLogRepository();
  const subscriptionService = new SubscriptionService(harness.shopRepository, auditLogRepository);
  const cityRoomService = new CityRoomService(harness.io);
  const broadcastService = new AlertBroadcastService(
    recipientRepository,
    harness.alertDispatch,
    filterTelemetry,
    cityRoomService,
  );
  const alertService = new AlertService(
    new MongoAlertEventRepository(),
    new MongoEventLogRepository(),
    harness.shopRepository,
    broadcastService,
    recipientRepository,
    filterTelemetry,
    new AlertDescriptionValidator(),
    subscriptionService,
    auditLogRepository,
  );

  return { alertService, broadcastService, filterTelemetry, recipientRepository, subscriptionService };
}

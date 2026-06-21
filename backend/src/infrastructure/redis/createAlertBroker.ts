import type { IAlertBroker } from '../../domain/services/IAlertBroker';
import {
  connectRedisClients,
  createRedisClients,
  disconnectRedisClients,
} from './createRedisClients';
import { InProcessAlertBroker } from './InProcessAlertBroker';
import { RedisAlertBroker } from './RedisAlertBroker';

export async function createAlertBroker(redisUrl?: string): Promise<{
  broker: IAlertBroker;
  cleanup: () => Promise<void>;
}> {
  const redisClients = createRedisClients(redisUrl);

  if (!redisClients) {
    return {
      broker: new InProcessAlertBroker(),
      cleanup: async () => undefined,
    };
  }

  await connectRedisClients(redisClients);

  return {
    broker: new RedisAlertBroker(redisClients.publisher, redisClients.subscriber),
    cleanup: () => disconnectRedisClients(redisClients),
  };
}

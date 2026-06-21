import Redis from 'ioredis';
import { env } from '../../config/env';

export interface RedisClients {
  publisher: Redis;
  subscriber: Redis;
}

export function createRedisClients(redisUrl?: string): RedisClients | null {
  const url = redisUrl ?? env.redisUrl;
  const enabled = redisUrl ? true : env.redisEnabled;

  if (!enabled || !url) {
    return null;
  }

  const publisher = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  const subscriber = new Redis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  return { publisher, subscriber };
}

export async function connectRedisClients(clients: RedisClients): Promise<void> {
  await Promise.all([clients.publisher.connect(), clients.subscriber.connect()]);
}

export async function disconnectRedisClients(clients: RedisClients): Promise<void> {
  await Promise.all([
    clients.publisher.quit().catch(() => undefined),
    clients.subscriber.quit().catch(() => undefined),
  ]);
}

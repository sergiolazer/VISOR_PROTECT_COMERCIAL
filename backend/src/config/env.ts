import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

export const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI ?? '',
  mongoChangeStream: process.env.MONGODB_CHANGE_STREAM === 'true',
  feedHistoryLimit: Number(process.env.FEED_HISTORY_LIMIT ?? 50),
  chatHistoryLimit: Number(process.env.CHAT_HISTORY_LIMIT ?? 50),
  chatMessageTtlSeconds: Number(process.env.CHAT_MESSAGE_TTL_SECONDS ?? 604800),
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  nodeEnv,
  cookieSecure: process.env.COOKIE_SECURE === 'true' || isProduction,
  cookieSameSite: (process.env.COOKIE_SAME_SITE ?? (isProduction ? 'none' : 'lax')) as
    | 'strict'
    | 'lax'
    | 'none',
  apiPublicUrl: process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
  localUploadDir: process.env.LOCAL_UPLOAD_DIR ?? 'uploads',
  mediaUrlExpiresInSeconds: Number(process.env.MEDIA_URL_EXPIRES_IN_SECONDS ?? 86400),
  maxUploadSizeBytes: Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 5 * 1024 * 1024),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  trustedImageDomains: (process.env.TRUSTED_IMAGE_DOMAINS ??
    'res.cloudinary.com,localhost,127.0.0.1')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean),
  redisUrl: process.env.REDIS_URL ?? '',
  redisEnabled: process.env.REDIS_ENABLED === 'true',
  instanceId: process.env.INSTANCE_ID ?? '',
  alertFilterTelemetryDebug: process.env.ALERT_FILTER_TELEMETRY_DEBUG !== 'false',
  alertFilterTelemetryPersist: process.env.ALERT_FILTER_TELEMETRY_PERSIST === 'true',
  frontendUrl: process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '',
  subscriptionPriceBrl: Number(process.env.SUBSCRIPTION_PRICE_BRL ?? 49.9),
} as const;

const INSECURE_JWT_SECRETS = new Set(['', 'change-me-in-production']);

/**
 * Falla al arrancar en producción si faltan secretos críticos.
 */
export function validateProductionConfig(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'production') {
    return;
  }

  const mongoUri = process.env.MONGO_URI ?? '';
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production';

  if (!mongoUri) {
    throw new Error('MONGO_URI es obligatorio en producción');
  }

  if (INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new Error('JWT_SECRET debe configurarse con un valor seguro en producción');
  }
}

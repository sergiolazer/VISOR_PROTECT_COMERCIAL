import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateProductionConfig } from '../../config/validateProductionConfig';

describe('validateProductionConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('no lanza error en development con JWT por defecto', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => validateProductionConfig()).not.toThrow();
  });

  it('lanza error en production con JWT inseguro', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'change-me-in-production');
    vi.stubEnv('MONGO_URI', 'mongodb://localhost/test');

    expect(() => validateProductionConfig()).toThrow(/JWT_SECRET/);
  });

  it('acepta production con JWT seguro y MONGO_URI', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'super-secure-random-secret-value');
    vi.stubEnv('MONGO_URI', 'mongodb://localhost/test');

    expect(() => validateProductionConfig()).not.toThrow();
  });
});

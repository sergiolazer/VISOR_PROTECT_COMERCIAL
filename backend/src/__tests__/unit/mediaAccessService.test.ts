import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

describe('MediaAccessService — scope por comercio', () => {
  const shopA = '00000000-0000-4000-8000-000000000010';
  const shopB = '00000000-0000-4000-8000-000000000011';
  const userId = 'user-media-test';
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(os.tmpdir(), 'visor-media-'));
    vi.stubEnv('LOCAL_UPLOAD_DIR', uploadDir);
    vi.stubEnv('JWT_SECRET', 'test-media-secret');
    vi.stubEnv('API_PUBLIC_URL', 'http://localhost:3001');
    vi.resetModules();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('el token firmado incluye shopId y solo permite acceso al comercio dueño', async () => {
    const { MediaAccessService } = await import('../../application/services/MediaAccessService');
    const { LocalImageStorageService } = await import(
      '../../infrastructure/storage/LocalImageStorageService'
    );

    const mediaAccess = new MediaAccessService();
    const storage = new LocalImageStorageService(mediaAccess);

    const uploaded = await storage.upload(
      Buffer.from('fake-image'),
      'image/jpeg',
      'photo.jpg',
      { shopId: shopA, userId },
    );

    expect(uploaded.storageKey).toMatch(new RegExp(`^${shopA}/`));

    const token = uploaded.url!.split('/api/media/')[1]!;
    const payload = mediaAccess.verifyAccessToken(token);
    expect(payload.shopId).toBe(shopA);
    expect(payload.userId).toBe(userId);
    expect(mediaAccess.isStorageKeyOwnedByShop(payload.key, shopA)).toBe(true);
    expect(mediaAccess.isStorageKeyOwnedByShop(payload.key, shopB)).toBe(false);
  });

  it('rechaza tokens legacy sin shopId en el payload', async () => {
    const { MediaAccessService } = await import('../../application/services/MediaAccessService');
    const mediaAccess = new MediaAccessService();
    const legacyToken = jwt.sign(
      { sub: 'media', key: `${shopA}/legacy.jpg` },
      'test-media-secret',
      { expiresIn: 3600 },
    );

    expect(() => mediaAccess.verifyAccessToken(legacyToken)).toThrow();
  });

  it('persiste archivos bajo directorio del comercio', async () => {
    const { MediaAccessService } = await import('../../application/services/MediaAccessService');
    const { LocalImageStorageService } = await import(
      '../../infrastructure/storage/LocalImageStorageService'
    );

    const mediaAccess = new MediaAccessService();
    const storage = new LocalImageStorageService(mediaAccess);

    await storage.upload(Buffer.from('content-a'), 'image/png', 'a.png', {
      shopId: shopA,
      userId,
    });

    const shopDir = path.join(uploadDir, 'chat', shopA);
    const [fileName] = await readdir(shopDir);
    const content = await readFile(path.join(shopDir, fileName!));
    expect(content.toString()).toBe('content-a');
  });
});

import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export interface MediaAccessPayload {
  sub: 'media';
  key: string;
  shopId: string;
  userId: string;
}

export class MediaAccessService {
  createSignedAccessUrl(
    storageKey: string,
    shopId: string,
    userId: string,
  ): { url: string; expiresAt: string } {
    const expiresInSeconds = env.mediaUrlExpiresInSeconds;
    const token = jwt.sign(
      { sub: 'media', key: storageKey, shopId, userId } satisfies MediaAccessPayload,
      env.jwtSecret,
      { expiresIn: expiresInSeconds },
    );

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const url = `${env.apiPublicUrl}/api/media/${token}`;

    return { url, expiresAt };
  }

  verifyAccessToken(token: string): MediaAccessPayload {
    const payload = jwt.verify(token, env.jwtSecret) as MediaAccessPayload;
    if (payload.sub !== 'media' || !payload.shopId || !payload.key) {
      throw new Error('Invalid media token payload');
    }
    return payload;
  }

  isStorageKeyOwnedByShop(storageKey: string, shopId: string): boolean {
    if (storageKey.includes('..')) {
      return false;
    }
    return storageKey.startsWith(`${shopId}/`);
  }
}

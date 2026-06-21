import type { Request, Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { MediaAccessService } from '../../application/services/MediaAccessService';
import { env } from '../../config/env';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export class MediaController {
  constructor(private readonly mediaAccessService: MediaAccessService) {}

  serveSignedMedia = (req: Request, res: Response): void => {
    try {
      const token = String(req.params.token);
      const payload = this.mediaAccessService.verifyAccessToken(token);

      if (!this.mediaAccessService.isStorageKeyOwnedByShop(payload.key, payload.shopId)) {
        res.status(403).json({ message: 'Acceso denegado al recurso', code: 'MEDIA_FORBIDDEN' });
        return;
      }

      const filePath = path.resolve(env.localUploadDir, 'chat', payload.key);

      if (!existsSync(filePath)) {
        res.status(404).json({ message: 'Recurso no encontrado' });
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', MIME_BY_EXT[extension] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      createReadStream(filePath).pipe(res);
    } catch {
      res.status(401).json({ message: 'Enlace de imagen expirado o inválido', code: 'MEDIA_TOKEN_INVALID' });
    }
  };
}

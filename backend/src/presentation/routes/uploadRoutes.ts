import { Router } from 'express';
import type { UploadController } from '../controllers/uploadController';
import type { MediaController } from '../controllers/mediaController';
import { createShopAuthMiddleware } from '../middleware/authMiddleware';
import { uploadImageMiddleware } from '../middleware/uploadMiddleware';
import type { AuthService } from '../../application/services/AuthService';

export function createUploadRouter(
  authService: AuthService,
  uploadController: UploadController,
): Router {
  const router = Router();
  const requireShopAuth = createShopAuthMiddleware(authService);

  router.post(
    '/upload-image',
    requireShopAuth,
    (req, res, next) => {
      uploadImageMiddleware(req, res, (error) => {
        if (error) {
          res.status(400).json({
            message: error instanceof Error ? error.message : 'Error al procesar archivo',
          });
          return;
        }
        next();
      });
    },
    uploadController.uploadImage,
  );

  return router;
}

export function createMediaRouter(mediaController: MediaController): Router {
  const router = Router();
  router.get('/:token', mediaController.serveSignedMedia);
  return router;
}

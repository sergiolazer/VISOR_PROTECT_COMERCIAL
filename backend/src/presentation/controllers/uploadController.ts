import type { Request, Response } from 'express';
import type { IImageStorageService } from '../../domain/services/IImageStorageService';

export class UploadController {
  constructor(private readonly imageStorageService: IImageStorageService) {}

  uploadImage = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.shopId || !req.user.userId) {
        res.status(401).json({ message: 'No autenticado', code: 'TOKEN_REQUIRED' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: 'Archivo de imagen requerido', code: 'FILE_REQUIRED' });
        return;
      }

      const result = await this.imageStorageService.upload(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        { shopId: req.user.shopId, userId: req.user.userId },
      );

      res.status(201).json({
        url: result.url,
        expires_at: result.expiresAt,
      });
    } catch (error) {
      console.error('[UploadController]', error);
      res.status(500).json({ message: 'Error al subir la imagen' });
    }
  };
}

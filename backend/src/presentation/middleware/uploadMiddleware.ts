import multer from 'multer';
import { env } from '../../config/env';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadImageMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSizeBytes },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error('Formato de imagen no permitido. Use JPEG, PNG o WebP.'));
      return;
    }
    callback(null, true);
  },
}).single('image');

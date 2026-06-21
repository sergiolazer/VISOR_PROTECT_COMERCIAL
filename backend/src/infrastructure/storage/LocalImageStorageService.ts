import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  IImageStorageService,
  ImageUploadContext,
  UploadImageResult,
} from '../../domain/services/IImageStorageService';
import type { MediaAccessService } from '../../application/services/MediaAccessService';
import { env } from '../../config/env';

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export class LocalImageStorageService implements IImageStorageService {
  constructor(private readonly mediaAccessService: MediaAccessService) {}

  async upload(
    file: Buffer,
    mimeType: string,
    _originalName: string,
    context: ImageUploadContext,
  ): Promise<UploadImageResult> {
    const extension = MIME_EXTENSION[mimeType] ?? '.jpg';
    const storageKey = `${context.shopId}/${randomUUID()}${extension}`;
    const uploadDir = path.resolve(env.localUploadDir, 'chat', context.shopId);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, path.basename(storageKey)), file);

    const signed = this.mediaAccessService.createSignedAccessUrl(
      storageKey,
      context.shopId,
      context.userId,
    );

    return {
      url: signed.url,
      expiresAt: signed.expiresAt,
      storageKey,
    };
  }
}

import type { IImageStorageService } from '../../domain/services/IImageStorageService';
import type { MediaAccessService } from '../../application/services/MediaAccessService';
import { CloudinaryImageStorageService } from './CloudinaryImageStorageService';
import { LocalImageStorageService } from './LocalImageStorageService';
import { env } from '../../config/env';

function isPlaceholderSecret(value: string): boolean {
  return !value || value === 'REPLACE' || value.startsWith('REPLACE_');
}

function isCloudinaryConfigured(): boolean {
  return (
    !isPlaceholderSecret(env.cloudinaryCloudName) &&
    !isPlaceholderSecret(env.cloudinaryApiKey) &&
    !isPlaceholderSecret(env.cloudinaryApiSecret)
  );
}

export function createImageStorageService(
  mediaAccessService: MediaAccessService,
): IImageStorageService {
  if (isCloudinaryConfigured()) {
    return new CloudinaryImageStorageService();
  }

  return new LocalImageStorageService(mediaAccessService);
}

import type { IImageStorageService } from '../../domain/services/IImageStorageService';
import type { MediaAccessService } from '../../application/services/MediaAccessService';
import { CloudinaryImageStorageService } from './CloudinaryImageStorageService';
import { LocalImageStorageService } from './LocalImageStorageService';
import { env } from '../../config/env';

export function createImageStorageService(
  mediaAccessService: MediaAccessService,
): IImageStorageService {
  if (env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret) {
    return new CloudinaryImageStorageService();
  }

  return new LocalImageStorageService(mediaAccessService);
}

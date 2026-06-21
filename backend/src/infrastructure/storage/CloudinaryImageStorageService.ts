import { v2 as cloudinary } from 'cloudinary';
import type {
  IImageStorageService,
  ImageUploadContext,
  UploadImageResult,
} from '../../domain/services/IImageStorageService';
import { env } from '../../config/env';

export class CloudinaryImageStorageService implements IImageStorageService {
  constructor() {
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
      secure: true,
    });
  }

  async upload(
    file: Buffer,
    mimeType: string,
    _originalName: string,
    context: ImageUploadContext,
  ): Promise<UploadImageResult> {
    const base64 = file.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `visor-protect/chat/${context.shopId}`,
      resource_type: 'image',
      overwrite: false,
      tags: ['chat', 'retention-7d', context.shopId],
    });

    const signedUrl = cloudinary.url(result.public_id, {
      resource_type: 'image',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + env.mediaUrlExpiresInSeconds,
    });

    return {
      url: signedUrl,
      expiresAt: new Date(Date.now() + env.mediaUrlExpiresInSeconds * 1000).toISOString(),
      storageKey: result.public_id,
    };
  }
}

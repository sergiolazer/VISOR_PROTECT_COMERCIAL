export interface ImageUploadContext {
  shopId: string;
  userId: string;
}

export interface UploadImageResult {
  url: string;
  expiresAt?: string;
  storageKey?: string;
}

export interface IImageStorageService {
  upload(
    file: Buffer,
    mimeType: string,
    originalName: string,
    context: ImageUploadContext,
  ): Promise<UploadImageResult>;
}

import { compressImageFile } from './imageCompression';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface UploadImageResponse {
  url: string;
  expires_at?: string;
}

export async function uploadChatImage(file: File): Promise<UploadImageResponse> {
  const compressed = await compressImageFile(file);
  const formData = new FormData();
  formData.append('image', compressed);

  const response = await fetch(`${API_URL}/api/upload-image`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Error al subir imagen');
  }

  return data as UploadImageResponse;
}

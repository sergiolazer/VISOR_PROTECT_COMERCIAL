import { compressImageFile } from './imageCompression';

import { API_URL } from './apiConfig';

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

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Error al subir imagen — respuesta inválida del servidor');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Error al subir imagen');
  }

  return data as UploadImageResponse;
}

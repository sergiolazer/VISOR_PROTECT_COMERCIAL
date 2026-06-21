const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.85;

export async function compressImageFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo procesar la imagen');
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Error al comprimir la imagen'));
          return;
        }
        resolve(result);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'chat-image';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

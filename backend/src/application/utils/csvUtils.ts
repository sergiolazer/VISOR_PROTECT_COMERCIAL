export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatMessageBody(type: string, content?: string | null, imageUrl?: string | null): string {
  if (type === 'image') {
    const caption = content?.trim();
    return caption ? `[Imagen] ${caption}` : '[Imagen]';
  }
  return content?.trim() ?? '';
}

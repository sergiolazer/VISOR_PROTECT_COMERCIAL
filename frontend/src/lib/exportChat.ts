import { API_URL } from './apiConfig';

export async function downloadChatExport(shopId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat/export/${shopId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string }).message ?? 'Error al exportar historial',
    );
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `reporte_seguridad_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

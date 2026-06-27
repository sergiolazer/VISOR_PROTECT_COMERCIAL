const LOCAL_API = 'http://localhost:3001';

/** Producción: vacío = same-origin (proxy Vercel → ALB). Dev: localhost. */
export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? LOCAL_API : '');

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? LOCAL_API : '');

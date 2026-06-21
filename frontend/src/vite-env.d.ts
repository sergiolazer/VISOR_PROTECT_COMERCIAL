/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_SHOP_ID: string;
  readonly VITE_SHOP_NAME: string;
  readonly VITE_CITY_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

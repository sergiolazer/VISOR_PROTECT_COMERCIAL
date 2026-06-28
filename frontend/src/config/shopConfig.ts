export interface ShopConfig {
  shopId: string;
  shopName: string;
  cityName: string;
}

export const shopConfig: ShopConfig = {
  shopId: import.meta.env.VITE_SHOP_ID ?? '00000000-0000-4000-8000-000000000001',
  shopName: import.meta.env.VITE_SHOP_NAME ?? 'Comercio Demo Centro',
  cityName: import.meta.env.VITE_CITY_NAME ?? 'Balneário Camboriú',
};

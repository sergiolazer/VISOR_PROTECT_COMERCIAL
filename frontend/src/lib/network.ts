import type { NetworkShopPin } from '@visor-protect/shared';
import { API_URL } from './apiConfig';

const fetchOptions: RequestInit = {
  credentials: 'include',
};

export async function fetchNetworkShops(city: string): Promise<NetworkShopPin[]> {
  const params = new URLSearchParams({ city });
  const response = await fetch(`${API_URL}/api/network/shops?${params}`, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Error al cargar comercios de la red');
  }

  return (data.shops ?? []) as NetworkShopPin[];
}

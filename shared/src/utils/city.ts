export function normalizeCityName(cityName: string): string {
  return cityName.trim().toLowerCase().replace(/\s+/g, '_');
}

export function citiesMatch(cityA: string, cityB: string): boolean {
  return normalizeCityName(cityA) === normalizeCityName(cityB);
}

export function getCityRoomName(cityName: string, prefix = 'city:'): string {
  return `${prefix}${normalizeCityName(cityName)}`;
}

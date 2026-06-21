import type { QuickReportCategory } from '@visor-protect/shared';
import { getCachedLocation, refreshLocationCache } from './locationCache';
import { sendQuickReport } from './reportQueue';

export async function submitQuickReport(category: QuickReportCategory): Promise<void> {
  let location = getCachedLocation();

  if (!location) {
    location = await refreshLocationCache();
  }

  await sendQuickReport({
    category,
    lat: location.lat,
    lng: location.lng,
  });
}

export type { QuickReportCategory };

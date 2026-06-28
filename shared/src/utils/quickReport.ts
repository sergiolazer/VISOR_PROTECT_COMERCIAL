import type { QuickReportCategory, ReelIconType } from '../types/events';
import { QUICK_REPORT_LABELS } from '../types/events';

export const CATEGORY_TO_ICON: Record<QuickReportCategory, ReelIconType> = {
  SUSPICIOUS_PERSON: 'suspicious',
  VEHICLE: 'theft',
  MINOR_INCIDENT: 'accident',
  SECURITY_REPORT: 'info',
};

export function getQuickReportDescription(category: QuickReportCategory): string {
  return `Relato rápido: ${QUICK_REPORT_LABELS[category]}`;
}

export function getCategoryIconType(category: QuickReportCategory): ReelIconType {
  return CATEGORY_TO_ICON[category];
}

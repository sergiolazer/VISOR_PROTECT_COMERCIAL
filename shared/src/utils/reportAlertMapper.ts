import type { AlertEventType, AlertSeverity } from '../types/alertEvent';
import type { QuickReportCategory, ReelIconType } from '../types/events';

const CATEGORY_TO_ALERT_TYPE: Record<QuickReportCategory, AlertEventType> = {
  SUSPICIOUS_PERSON: 'SOSPECHOSO',
  VEHICLE: 'SOSPECHOSO',
  MINOR_INCIDENT: 'ACCIDENTE',
  SECURITY_REPORT: 'SOSPECHOSO',
};

const CATEGORY_TO_SEVERITY: Record<QuickReportCategory, AlertSeverity> = {
  SUSPICIOUS_PERSON: 'MEDIA',
  VEHICLE: 'BAJA',
  MINOR_INCIDENT: 'BAJA',
  SECURITY_REPORT: 'BAJA',
};

export function mapReportCategoryToAlertType(category: QuickReportCategory): AlertEventType {
  return CATEGORY_TO_ALERT_TYPE[category];
}

export function mapReportCategoryToSeverity(category: QuickReportCategory): AlertSeverity {
  return CATEGORY_TO_SEVERITY[category];
}

export function mapReportToAlertType(
  category?: QuickReportCategory,
  iconType?: ReelIconType,
): AlertEventType {
  if (category) {
    return CATEGORY_TO_ALERT_TYPE[category];
  }
  if (iconType === 'theft') {
    return 'ROBO';
  }
  if (iconType === 'accident') {
    return 'ACCIDENTE';
  }
  return 'SOSPECHOSO';
}

export function mapReportToSeverity(
  category?: QuickReportCategory,
  iconType?: ReelIconType,
): AlertSeverity {
  if (category) {
    return CATEGORY_TO_SEVERITY[category];
  }
  if (iconType === 'suspicious') {
    return 'MEDIA';
  }
  return 'BAJA';
}

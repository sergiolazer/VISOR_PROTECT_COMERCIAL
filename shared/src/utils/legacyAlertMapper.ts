import type { AlertEventType, AlertSeverity } from '../types/alertEvent';
import type { AlertType, UrgencyLevel } from '../types/alert';

const LEGACY_TYPE_MAP: Record<AlertType, AlertEventType> = {
  ROBO: 'ROBO',
  ACCIDENTE: 'ACCIDENTE',
  SOSPECHOSO: 'SOSPECHOSO',
};

export function mapLegacyAlertType(alertType: AlertType): AlertEventType {
  return LEGACY_TYPE_MAP[alertType];
}

export function mapLegacyUrgencyToSeverity(urgencyLevel: UrgencyLevel): AlertSeverity {
  if (urgencyLevel === 'CRITICAL') {
    return 'CRITICA';
  }
  return 'MEDIA';
}

export function mapSeverityToLegacyUrgency(severity: AlertSeverity): UrgencyLevel {
  if (severity === 'CRITICA') {
    return 'CRITICAL';
  }
  return 'WARNING';
}

export function isLegacyAlertType(value: string): value is AlertType {
  return value in LEGACY_TYPE_MAP;
}

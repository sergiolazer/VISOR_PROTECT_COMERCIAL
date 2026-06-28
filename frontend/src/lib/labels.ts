/** Rótulos de UI em português brasileiro para enums técnicos. */

export const ALERT_TYPE_LABELS: Record<string, string> = {
  ROBO: 'Roubo',
  ACCIDENTE: 'Acidente',
  SOSPECHOSO: 'Suspeito',
  INTRUSION: 'Invasão',
  VANDALISMO: 'Vandalismo',
  EMERGENCIA: 'Emergência',
};

export const URGENCY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica',
  WARNING: 'Atenção',
  CRITICA: 'Crítica',
  MEDIA: 'Média',
  BAJA: 'Baixa',
};

export function formatAlertTypeLabel(value?: string | null): string {
  if (!value) {
    return 'Emergência';
  }
  return ALERT_TYPE_LABELS[value] ?? value;
}

export function formatUrgencyLabel(value?: string | null): string {
  if (!value) {
    return 'Crítica';
  }
  return URGENCY_LABELS[value] ?? value;
}

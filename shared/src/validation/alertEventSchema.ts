import { z } from 'zod';
import { ALERT_EVENT_TYPES, ALERT_SEVERITIES } from '../types/alertEvent';

export const createAlertEventClientSchema = z.object({
  type: z.enum(ALERT_EVENT_TYPES),
  severity: z.enum(ALERT_SEVERITIES),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().trim().min(5).max(500),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type CreateAlertEventClientPayload = z.infer<typeof createAlertEventClientSchema>;

import { z } from 'zod';
import { ALERT_TYPES, URGENCY_LEVELS } from '../types/alert';
import { QUICK_REPORT_CATEGORIES, REEL_ICON_TYPES } from '../types/events';

const geoLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const physicalDescriptionSchema = z
  .string()
  .min(10, 'La descripción debe tener al menos 10 caracteres')
  .max(500, 'La descripción no puede exceder 500 caracteres')
  .refine(
    (value) => !/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(value),
    'Use descripciones físicas (ej. "Hombre, camisa azul"). Evite nombres propios.',
  );

export const reelReportSchema = z.object({
  event_id: z.string().uuid(),
  sender_shop_id: z.string().min(1),
  sender_shop_name: z.string().min(1),
  city: z.string().min(1).max(100),
  description: physicalDescriptionSchema,
  location: geoLocationSchema.optional(),
  icon_type: z.enum(REEL_ICON_TYPES).default('info'),
  timestamp: z.string().datetime(),
});

export const panicAlertSchema = z.object({
  event_id: z.string().uuid(),
  sender_shop_id: z.string().min(1),
  sender_shop_name: z.string().min(1),
  city: z.string().min(1).max(100),
  location: geoLocationSchema,
  alert_type: z.enum(ALERT_TYPES),
  urgency_level: z.enum(URGENCY_LEVELS),
  description: physicalDescriptionSchema.optional(),
  timestamp: z.string().datetime(),
});

export const confirmReportSchema = z.object({
  event_id: z.string().uuid(),
});

/** Payload cliente para new_report — sin identidad de comercio (la aporta el servidor vía JWT). */
export const newReportClientSchema = z.object({
  category: z.enum(QUICK_REPORT_CATEGORIES).optional(),
  description: physicalDescriptionSchema.optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  icon_type: z.enum(REEL_ICON_TYPES).optional(),
});

/** Payload cliente para emergency_alert — sin identidad de comercio. */
export const emergencyAlertClientSchema = z.object({
  alert_type: z.enum(ALERT_TYPES).default('ROBO'),
  urgency_level: z.enum(URGENCY_LEVELS).default('CRITICAL'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(500).optional(),
});

export const quickReportSchema = z.object({
  category: z.enum(QUICK_REPORT_CATEGORIES),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type ReelReportInput = z.infer<typeof reelReportSchema>;
export type PanicAlertInput = z.infer<typeof panicAlertSchema>;
export type ConfirmReportInput = z.infer<typeof confirmReportSchema>;
export type QuickReportInput = z.infer<typeof quickReportSchema>;
export type NewReportClientInput = z.infer<typeof newReportClientSchema>;
export type EmergencyAlertClientInput = z.infer<typeof emergencyAlertClientSchema>;

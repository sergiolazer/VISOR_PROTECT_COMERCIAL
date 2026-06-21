import { z } from 'zod';
import { ALERT_TYPES, URGENCY_LEVELS } from '../types/alert';

const geoLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const emergencyAlertSchema = z.object({
  event_id: z.string().uuid({ message: 'event_id debe ser un UUID válido' }),
  sender_shop_id: z.string().min(1, 'sender_shop_id es obligatorio'),
  sender_shop_name: z.string().min(1, 'sender_shop_name es obligatorio'),
  city: z.string().min(1, 'city es obligatoria').max(100),
  location: geoLocationSchema,
  alert_type: z.enum(ALERT_TYPES, {
    errorMap: () => ({ message: `alert_type debe ser uno de: ${ALERT_TYPES.join(', ')}` }),
  }),
  urgency_level: z.enum(URGENCY_LEVELS, {
    errorMap: () => ({ message: `urgency_level debe ser uno de: ${URGENCY_LEVELS.join(', ')}` }),
  }),
  timestamp: z.string().datetime({ message: 'timestamp debe ser ISO8601 válido' }),
});

export type EmergencyAlertInput = z.infer<typeof emergencyAlertSchema>;

export const joinCitySchema = z.object({
  city_name: z.string().min(1, 'city_name es obligatorio').max(100),
});

export type JoinCityInput = z.infer<typeof joinCitySchema>;

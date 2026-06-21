import { AlertValidationError, ALERT_ERROR_CODES } from '../../domain/errors/AlertValidationError';

/** Términos que describen características físicas/personales — prohibidos (LGPD). */
const PROHIBITED_PHYSICAL_PATTERNS = [
  /\b(negro|negra|blanco|blanca|moreno|morena|indígena|indigena|asiático|asiatico|asiática|asiatica)\b/i,
  /\b(alto|alta|bajo|baja|gordo|gorda|delgado|delgada|obeso|obesa)\b/i,
  /\b(joven|viejo|vieja|anciano|anciana|adolescente|niño|niña|nino|nina)\b/i,
  /\b(hombre|mujer|varón|varon|masculino|femenino)\b/i,
  /\b(cabello|pelo|barba|tatuaje|tatuajes|ropa|camisa|pantalón|pantalon|vestido)\b/i,
  /\b(negro|negra|rubio|rubia|pelirrojo|pelirroja)\s+(de|con|vestido|usando)/i,
];

const PROHIBITED_PERSONAL_DATA_PATTERNS = [
  /\b(cpf|rg|documento|identidad|nombre completo|telefone|teléfono|telefono|email|correo)\b/i,
];

export class AlertDescriptionValidator {
  validate(description: string): string {
    const normalized = description.trim();

    if (normalized.length < 5) {
      throw new AlertValidationError(
        'La descripción debe ser objetiva y tener al menos 5 caracteres',
        ALERT_ERROR_CODES.INVALID_PAYLOAD,
      );
    }

    for (const pattern of PROHIBITED_PHYSICAL_PATTERNS) {
      if (pattern.test(normalized)) {
        throw new AlertValidationError(
          'La descripción no puede incluir características físicas de personas (LGPD). Describa solo el acto o incidente.',
          ALERT_ERROR_CODES.INVALID_PAYLOAD,
        );
      }
    }

    for (const pattern of PROHIBITED_PERSONAL_DATA_PATTERNS) {
      if (pattern.test(normalized)) {
        throw new AlertValidationError(
          'La descripción no puede incluir datos personales identificables (LGPD).',
          ALERT_ERROR_CODES.INVALID_PAYLOAD,
        );
      }
    }

    return normalized;
  }
}

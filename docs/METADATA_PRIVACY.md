# Metadatos y LGPD — Guía para desarrolladores

Visor Protect Comercio opera bajo la **LGPD** (Lei Geral de Proteção de Dados). Los campos `metadata` en alertas, logs de auditoría y payloads de socket **no deben contener datos personales identificables (PII)**.

## Estado actual

No existe aún un filtro semántico automático que detecte PII en texto libre (`description`, `metadata`, mensajes de chat). La validación actual cubre formatos y dominios (URLs de imagen, tipos de alerta), **no el contenido semántico**.

Hasta implementar un sanitizador (NLP/reglas), **cada desarrollador es responsable** de no introducir PII en metadatos estructurados.

## Qué NO incluir en `metadata`

| Prohibido | Ejemplos |
|-----------|----------|
| Nombre completo de personas | `"Juan Pérez"` |
| Documento (CPF, RG, CNPJ de terceros) | `"123.456.789-00"` |
| Teléfono o e-mail personal | `"+55 11 99999-0000"` |
| Dirección exacta de una persona | `"Rua X, 123, apto 4"` |
| Placa de vehículo vinculada a individuo | `"ABC-1D23"` |
| Biometría, foto facial identificable | URLs o IDs de rostros |

## Qué SÍ es aceptable

- IDs internos del sistema (`event_log_id`, `alert_event_id`, `shop_id`)
- Categorías y tipos enumerados (`alert_type`, `report_category`, `icon_type`)
- Coordenadas del **local comercial** (ya anonimizadas a nivel de negocio)
- Flags técnicos (`is_legacy_replay`, `source: 'legacy'`)

## Dónde revisar antes de mergear

1. **`AlertService.persistAlertEvent`** — objeto `metadata` en alertas.
2. **`AuditLogRepository.create`** — campo `metadata` en auditoría.
3. **Handlers Socket.io** — cualquier campo extra en payloads de `new_report`, `emergency_alert`, chat.
4. **Frontend** — no enviar nombres de clientes o empleados en campos libres si el backend los persiste.

## Buenas prácticas

- Preferir **categorías** sobre descripciones con nombres propios cuando sea posible.
- Si un dato es necesario para operación interna, **anonimizar** (hash irreversible, últimos 4 dígitos, pseudónimo).
- En logs de consola, evitar `console.log` con payloads completos que puedan contener PII.
- Exportaciones CSV de chat: el contenido ya está sujeto a retención de 7 días; no ampliar campos exportados sin revisión legal.

## Roadmap (LGPD-02)

- [ ] Validador de PII basado en reglas (CPF, e-mail, teléfono BR).
- [ ] Rechazo en API con código `PII_DETECTED` antes de persistir.
- [ ] Revisión periódica de índices y backups con datos retenidos.

## Referencias internas

- Retención de datos: [DATA_RETENTION.md](./DATA_RETENTION.md)
- Esquema de alertas: paquete `@visor-protect/shared` (`CreateAlertEventInput`)

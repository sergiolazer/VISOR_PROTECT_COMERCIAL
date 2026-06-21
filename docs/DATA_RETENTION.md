# Política de retención y borrado automático — Visor Protect Comercio

Visor Protect aplica **minimización de datos** (LGPD): los mensajes e imágenes del chat se conservan solo el tiempo estrictamente necesario para la coordinación de seguridad entre comercios (**7 días**). El borrado no depende de cron jobs en Node.js; lo ejecutan MongoDB (TTL) y el proveedor de almacenamiento (Lifecycle).

---

## 1. MongoDB — Índice TTL en `messages`

Cada documento de la colección `messages` incluye `createdAt` (generado por Mongoose `timestamps`).

Índice definido en `backend/src/infrastructure/database/mongodb/models/Message.model.ts`:

```javascript
MessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 604800 }, // 7 días
);
```

**Comportamiento:** MongoDB elimina el documento cuando `createdAt + 604800 segundos < fecha actual`. El monitor TTL corre aproximadamente cada 60 segundos.

**Variable de entorno (opcional):** `CHAT_MESSAGE_TTL_SECONDS=604800`

**Verificar índice en Atlas:**

```javascript
db.messages.getIndexes()
// Debe aparecer: { createdAt: 1 } con expireAfterSeconds: 604800
```

---

## 2. Cloud Storage — Lifecycle a 7 días

Las imágenes del chat deben expirar en el mismo plazo que los metadatos en MongoDB.

### AWS S3

1. Consola AWS → **S3** → bucket (ej. `visor-protect-chat`).
2. Pestaña **Management** → **Lifecycle rules** → **Create lifecycle rule**.
3. Configuración recomendada:

| Campo | Valor |
|-------|--------|
| Rule name | `chat-images-expire-7-days` |
| Prefix | `chat/` (o `visor-protect/chat/`) |
| Actions | **Expire current versions of objects** |
| Days after creation | `7` |

4. Guardar. Los objetos se eliminan automáticamente; no requiere Lambda ni cron.

**Ejemplo JSON (API/CloudFormation):**

```json
{
  "Rules": [{
    "ID": "chat-images-expire-7-days",
    "Status": "Enabled",
    "Filter": { "Prefix": "visor-protect/chat/" },
    "Expiration": { "Days": 7 }
  }]
}
```

### Cloudinary

1. **Media Library** → Settings → **Auto-delete** (plan Enterprise), **o**
2. Regla programada con **Upload Preset** + tag `chat` y script de limpieza vía Admin API, **o**
3. **Backup & retention** → configurar retención máxima en el folder `visor-protect/chat`.

Recomendación operativa: al subir, usar folder fijo `visor-protect/chat` y documentar en el runbook que las imágenes tienen TTL de 7 días alineado con MongoDB.

```javascript
// Ejemplo: tag en upload para auditoría
cloudinary.uploader.upload(dataUri, {
  folder: 'visor-protect/chat',
  tags: ['chat', 'retention-7d'],
});
```

### Almacenamiento local (solo desarrollo)

En dev, los archivos en `uploads/chat/` **no** tienen lifecycle automático. Usar Cloudinary o S3 en staging/producción. Opcional: cron del SO o script `find uploads/chat -mtime +7 -delete` en entornos locales.

---

## 3. Alineación legal (LGPD)

| Principio | Implementación |
|-----------|----------------|
| Minimización | TTL 7 días en DB + storage |
| Transparencia | Aviso visible en `ChatBox.tsx` |
| Finalidad | Solo coordinación de seguridad entre comercios |
| Sin procesamiento extra | Sin workers Node.js dedicados al borrado |

Declaración sugerida para política de privacidad:

> *"Los mensajes e imágenes del chat vecinal se eliminan automáticamente a los 7 días de su envío, conservándose únicamente el tiempo necesario para la finalidad de seguridad colaborativa."*

---

## 4. Exportación de historial (CSV)

- Endpoint: `GET /api/chat/export/:shopId` (autenticado).
- El `shopId` debe coincidir con el comercio del JWT; se registra auditoría `EXPORT_CHAT`.
- Streaming vía cursor de Mongoose — sin cargar todo el historial en RAM.

---

## 5. Checklist de despliegue

- [ ] Índice TTL activo en MongoDB Atlas (`getIndexes()`).
- [ ] Lifecycle rule S3 o política Cloudinary configurada (7 días).
- [ ] `CHAT_MESSAGE_TTL_SECONDS=604800` en `.env` de producción.
- [ ] Aviso de retención visible en la Web App.
- [ ] URLs firmadas de media con TTL ≤ 7 días (`MEDIA_URL_EXPIRES_IN_SECONDS`).

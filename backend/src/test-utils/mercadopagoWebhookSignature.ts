import { createHmac } from 'node:crypto';

export function buildMercadoPagoWebhookHeaders(
  dataId: string,
  secret: string,
  requestId = 'test-request-id',
  ts = Date.now(),
): { xSignature: string; xRequestId: string } {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');

  return {
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId: requestId,
  };
}

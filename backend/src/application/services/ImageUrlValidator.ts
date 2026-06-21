import { env } from '../../config/env';

export class ImageUrlValidator {
  constructor(private readonly trustedDomains: string[]) {}

  validate(imageUrl: string): void {
    let parsed: URL;

    try {
      parsed = new URL(imageUrl);
    } catch {
      throw new Error('URL de imagen inválida');
    }

    if (env.nodeEnv === 'production' && parsed.protocol !== 'https:') {
      throw new Error('Las URLs de imagen deben usar HTTPS en producción');
    }

    const hostname = parsed.hostname.toLowerCase();
    const isTrusted = this.trustedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );

    if (!isTrusted) {
      throw new Error(`Dominio de imagen no autorizado: ${hostname}`);
    }
  }
}

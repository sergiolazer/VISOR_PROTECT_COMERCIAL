import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../../application/services/AuthService';
import { AuthError } from '../../domain/errors/AuthError';
import { setAuthCookie, clearAuthCookie } from '../utils/authCookie';
import { extractAuthToken } from '../utils/extractAuthToken';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  shop_id: z.string().uuid().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
});

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, shop_id } = loginSchema.parse(req.body);
      const result = await this.authService.login(email, password, shop_id);
      this.sendSession(res, result);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const params = registerSchema.parse(req.body);
      const result = await this.authService.register(params);
      res.status(201);
      this.sendSession(res, result);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'No autenticado', code: 'TOKEN_REQUIRED' });
        return;
      }

      const token = extractAuthToken(req);
      const session = await this.authService.getSessionProfile(req.user, token ?? undefined);
      res.json(session);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = extractAuthToken(req);
      if (!token) {
        res.status(401).json({ message: 'Token de autenticación requerido', code: 'TOKEN_REQUIRED' });
        return;
      }

      const result = await this.authService.refreshSession(token);
      this.sendSession(res, result);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  logout = (_req: Request, res: Response): void => {
    clearAuthCookie(res);
    res.json({ ok: true });
  };

  private sendSession(res: Response, result: Awaited<ReturnType<AuthService['login']>>): void {
    setAuthCookie(res, result.token);
    res.json(this.authService.toPublicSession(result));
  }

  private handleError(res: Response, error: unknown): void {
    if (error instanceof AuthError) {
      const status = error.code === 'INVALID_CREDENTIALS' ? 401 : 403;
      res.status(status).json({ message: error.message, code: error.code });
      return;
    }

    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', details: error.issues });
      return;
    }

    console.error('[AuthController]', error);
    res.status(500).json({ message: 'Error interno de autenticación' });
  }
}

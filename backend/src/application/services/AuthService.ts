import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';
import type { AuthenticatedUser, JwtPayload } from '../../domain/auth/JwtPayload';
import { AuthError } from '../../domain/errors/AuthError';
import type { ShopRecord } from '../../domain/entities/ShopRecord';
import type {
  SubscriptionService,
  SubscriptionTransitionNotice,
} from './SubscriptionService';

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    shopId: string;
    shopIds: string[];
  };
  shops: ShopRecord[];
  subscriptionNotices?: SubscriptionTransitionNotice[];
}

export interface PublicSession {
  expiresAt: string;
  user: LoginResult['user'];
  shops: ShopRecord[];
  subscriptionNotices?: SubscriptionTransitionNotice[];
}

export interface RegisterParams {
  email: string;
  password: string;
  name: string;
}

export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly shopRepository: IShopRepository,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async register(params: RegisterParams): Promise<LoginResult> {
    const existing = await this.userRepository.findByEmail(params.email);
    if (existing) {
      throw new AuthError('El email ya está registrado', 'UNAUTHORIZED');
    }

    const passwordHash = await bcrypt.hash(params.password, 12);
    const user = await this.userRepository.create({
      email: params.email,
      passwordHash,
      name: params.name,
    });

    const shopId = user.shopIds[0];
    if (!shopId) {
      throw new AuthError('Usuario sin comercio asignado', 'UNAUTHORIZED');
    }

    return this.buildLoginResult(user.id, user.email, user.name, user.role, user.shopIds, shopId);
  }

  async login(email: string, password: string, shopId?: string): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AuthError('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AuthError('Usuario inactivo', 'USER_INACTIVE');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new AuthError('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }

    const activeShopId = shopId ?? user.shopIds[0];
    if (!activeShopId) {
      throw new AuthError('Usuario sin comercio asignado', 'UNAUTHORIZED');
    }

    await this.assertShopAccess(user.id, activeShopId);
    await this.userRepository.updateLastLogin(user.id);

    return this.buildLoginResult(user.id, user.email, user.name, user.role, user.shopIds, activeShopId);
  }

  verifyToken(token: string): AuthenticatedUser {
    const payload = this.verifyTokenPayload(token);
    return this.toAuthenticatedUser(payload);
  }

  async refreshSession(token: string): Promise<LoginResult> {
    const payload = this.verifyTokenPayload(token, { allowExpired: true });

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new AuthError('Usuario no encontrado', 'UNAUTHORIZED');
    }

    if (!user.isActive) {
      throw new AuthError('Usuario inactivo', 'USER_INACTIVE');
    }

    await this.assertShopAccess(user.id, payload.shopId);

    return this.buildLoginResult(
      user.id,
      user.email,
      user.name,
      user.role,
      user.shopIds,
      payload.shopId,
    );
  }

  private verifyTokenPayload(
    token: string,
    options?: { allowExpired?: boolean },
  ): JwtPayload {
    try {
      return jwt.verify(token, env.jwtSecret, {
        ignoreExpiration: options?.allowExpired ?? false,
      }) as JwtPayload;
    } catch (error) {
      if (
        options?.allowExpired &&
        error instanceof jwt.TokenExpiredError
      ) {
        return jwt.verify(token, env.jwtSecret, {
          ignoreExpiration: true,
        }) as JwtPayload;
      }
      throw new AuthError('Token inválido o expirado', 'TOKEN_INVALID');
    }
  }

  private toAuthenticatedUser(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      shopId: payload.shopId,
      shopIds: payload.shopIds,
    };
  }

  toPublicSession(result: LoginResult): PublicSession {
    return {
      user: result.user,
      shops: result.shops,
      expiresAt: result.expiresAt,
      subscriptionNotices: result.subscriptionNotices,
    };
  }

  async getSessionProfile(user: AuthenticatedUser, token?: string): Promise<PublicSession> {
    const dbUser = await this.userRepository.findById(user.userId);
    const { shops } = await this.subscriptionService.refreshShopsSubscriptionStates(user.shopIds);

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: dbUser?.name ?? user.email,
        role: user.role,
        shopId: user.shopId,
        shopIds: user.shopIds,
      },
      shops,
      expiresAt: token ? this.getTokenExpiryIso(token) : new Date(Date.now() + this.getJwtMaxAgeMs()).toISOString(),
    };
  }

  private getJwtMaxAgeMs(): number {
    const value = env.jwtExpiresIn;
    if (value.endsWith('h')) {
      return Number(value.slice(0, -1)) * 60 * 60 * 1000;
    }
    if (value.endsWith('d')) {
      return Number(value.slice(0, -1)) * 24 * 60 * 60 * 1000;
    }
    return 24 * 60 * 60 * 1000;
  }

  private getTokenExpiryIso(token: string): string {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000).toISOString();
    }
    return new Date(Date.now() + this.getJwtMaxAgeMs()).toISOString();
  }
  async assertShopAccess(userId: string, shopId: string): Promise<void> {
    const ownsShop = await this.userRepository.userOwnsShop(userId, shopId);
    if (!ownsShop) {
      throw new AuthError('No tiene acceso a este comercio', 'UNAUTHORIZED');
    }
  }

  private signToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  private async buildLoginResult(
    userId: string,
    email: string,
    name: string,
    role: string,
    shopIds: string[],
    shopId: string,
  ): Promise<LoginResult> {
    const token = this.signToken({ sub: userId, email, role, shopId, shopIds });

    const { shops, transitions } =
      await this.subscriptionService.refreshShopsSubscriptionStates(shopIds);

    return {
      token,
      expiresAt: this.getTokenExpiryIso(token),
      user: { id: userId, email, name, role, shopId, shopIds },
      shops,
      subscriptionNotices: transitions.length > 0 ? transitions : undefined,
    };
  }
}

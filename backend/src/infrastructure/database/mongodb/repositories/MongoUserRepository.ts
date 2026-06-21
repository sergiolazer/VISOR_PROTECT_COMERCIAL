import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { CreateUserParams, UserRecord } from '../../../../domain/entities/UserRecord';
import { UserModel } from '../models/User.model';

function mapUser(doc: {
  _id: { toString(): string };
  email: string;
  name: string;
  role: UserRecord['role'];
  shop_ids: string[];
  is_active: boolean;
  password_hash?: string;
}): UserRecord & { passwordHash?: string } {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    shopIds: doc.shop_ids,
    isActive: doc.is_active,
    passwordHash: doc.password_hash,
  };
}

export class MongoUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<(UserRecord & { passwordHash: string }) | null> {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (!user) {
      return null;
    }
    const mapped = mapUser(user);
    return { ...mapped, passwordHash: user.password_hash };
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const user = await UserModel.findById(userId).lean();
    return user ? mapUser(user) : null;
  }

  async create(params: CreateUserParams): Promise<UserRecord> {
    const user = await UserModel.create({
      email: params.email.toLowerCase(),
      password_hash: params.passwordHash,
      name: params.name,
      role: params.role ?? 'OWNER',
      shop_ids: params.shopIds ?? [],
      is_active: true,
    });
    return mapUser(user);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { last_login_at: new Date() });
  }

  async userOwnsShop(userId: string, shopId: string): Promise<boolean> {
    const user = await UserModel.findById(userId).select('shop_ids').lean();
    return user?.shop_ids.includes(shopId) ?? false;
  }
}

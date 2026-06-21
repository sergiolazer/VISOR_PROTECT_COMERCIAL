import type { CreateUserParams, UserRecord } from '../entities/UserRecord';

export interface IUserRepository {
  findByEmail(email: string): Promise<(UserRecord & { passwordHash: string }) | null>;
  findById(userId: string): Promise<UserRecord | null>;
  create(params: CreateUserParams): Promise<UserRecord>;
  updateLastLogin(userId: string): Promise<void>;
  userOwnsShop(userId: string, shopId: string): Promise<boolean>;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'OPERATOR';
  shopIds: string[];
  isActive: boolean;
}

export interface CreateUserParams {
  email: string;
  passwordHash: string;
  name: string;
  role?: UserRecord['role'];
  shopIds?: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  shopId: string;
  shopIds: string[];
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  shopId: string;
  shopIds: string[];
}

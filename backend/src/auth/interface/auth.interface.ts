export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  userType: string;
  roles?: { id: string; name: string }[];
  organizationId?: string;
  propertyId?: string;
  permissions?: any[];
  generateNewPw?: boolean;
}

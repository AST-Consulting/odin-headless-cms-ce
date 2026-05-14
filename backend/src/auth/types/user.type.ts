// user.type.ts

// import { Permission } from 'src/user/schema/user.schema';

export type TCurrentUserType = {
  sub: string;
  name: string;
  email: string;
  refreshToken?: string;
  userType?: string;
  profileId?: string;
  _id?: string;
  verified?: boolean;
  totalCreditsBought?: number;
  totalCreditsUsed?: number;
  organizationId?: string;
  propertyId?: string;
  roles?: { id: string; name: string }[];
};

export type TAdminUserType = {
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  //   permissions: Permission[];
  roles: string[];
};

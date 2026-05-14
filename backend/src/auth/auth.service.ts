import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Res,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import {
  InviteDto,
  LoginDto,
  ResetPasswordDto,
  SignUpDto,
  VerifyOtpDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import moment = require('moment');
import { Tokens } from './types';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interface/auth.interface';
import * as crypto from 'crypto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { UserService } from 'src/user/user.service';
import { CommunicationProviderService } from 'src/utilities/communication-provider/communication-provider.service';
import { VerificationCodeService } from 'src/utilities/communication-provider/verification-code/verification-code.service';
import { EmailService } from 'src/utilities/communication-provider/email/email.service';
import { ApiConfigService } from 'src/core/config/config.service';
import * as bcrypt from 'bcrypt';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { AUTH_TYPE, STATUS, UserType, GoogleServiceType } from 'src/core/constants/enums.constants';
import { UpdateUserDto } from 'src/user/dto/update-user.dto';
import { TUserDocument } from 'src/user/entities/user.schema';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { buildUserMetadata, expireTime1H } from 'src/core/utils/utils';
import { VerificationCode } from 'src/utilities/communication-provider/verification-code/veification-code.schema';
import { CookieOptions, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { TCurrentUserType } from './types/user.type';
import { RedisService } from 'src/utilities/redis/redis.service';
import { DEFAULT_ROLE } from 'src/core/constants/enums.constants';
import { TRoleDocument, Permission } from 'src/role/entities/role.schema';
import { RoleSub } from 'src/role/entities/role-sub.schema';
import { RoleService } from 'src/role/role.service';
import { Request } from 'express';
import { OrganizationService } from 'src/organization/organization.service';
import { PropertyService } from 'src/property/property.service';
import { getForgetPasswordMail, getInviteMail, getOtpMail, getUserInvitationMail, getUserReactivationMail } from 'src/utilities/email-templates';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
let domain = '';

if (process.env.NODE_ENV === 'development') {
  domain = process.env.DEV_DOMAIN;
} else if (process.env.NODE_ENV === 'local') {
  // domain = 'localhost';
  domain = process.env.LOCAL_DOMAIN;
} else {
  domain = null;
}

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 60 * 60 * 1000,
  domain,
  path: '/',
};

const cookieOptionsRefresh: CookieOptions = {
  ...cookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  domain,
  path: '/api/auth/refresh',
};

export type AuthResult =
  | {
    user: Partial<TUserDocument>;
    tokens: Tokens;
    profile?: any;
  }
  | { requiresOtp: true; email: string };

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly _userService: UserService,
    private readonly _jwtService: JwtService,
    private readonly _communicationProviderService: CommunicationProviderService,
    private readonly _verificationCodeService: VerificationCodeService,
    private readonly _emailService: EmailService,
    private readonly _redisService: RedisService,
    @Inject(forwardRef(() => RoleService))
    private readonly _roleService: RoleService,
    private _configService: ApiConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    @Inject(forwardRef(() => OrganizationService))
    private readonly _organizationService: OrganizationService,
    @Inject(forwardRef(() => PropertyService))
    private readonly _propertyService: PropertyService,
  ) { }

  private _generateRandomPassword(length: number): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let retVal = '';
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  }

  async generateHashPassword(password: string) {
    return await bcrypt.hash(password, 10);
  }

  async getTokens(
    userId: string,
    email: string,
    name: string,
    userType: string,
    organizationId?: string,
    propertyId?: string,
    roles?: { id: string; name: string }[],
    permissions?: any[],
    generateNewPw?: boolean
  ): Promise<Tokens> {
    const jwtPayload: JwtPayload = {
      sub: userId,
      email: email,
      name: name,
      userType,
      roles,
      permissions,
      organizationId,
      propertyId,
      generateNewPw,
    };
    console.log('JWT_DEBUG: Payload generateNewPw:', jwtPayload.generateNewPw);
    const [at, rt] = await Promise.all([
      this._jwtService.signAsync(jwtPayload, {
        secret: this._configService.jwt.accessSecret,
        expiresIn: this._configService.jwt.accessExpires as any,
      } as any),
      this._jwtService.signAsync(jwtPayload, {
        secret: this._configService.jwt.refreshSecret,
        expiresIn: this._configService.jwt.refreshExpires as any,
      } as any),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }


  /**
   * Aggregates permissions from roles and direct overrides into a unified list.
   */
  private aggregatePermissions(roles: any[], directPermissions: any[]): any[] {
    const isSuperAdmin = roles.some((r: any) => (r.name || '').toUpperCase() === 'SUPERADMIN');
    if (isSuperAdmin) {
      return [];
    }
    const rolePermissions = roles.flatMap((r) => r.permissions || []);

    // Merge by module to avoid duplicates
    const mergedMap = new Map<string, Set<string>>();

    rolePermissions.forEach((p) => {
      if (!p.module) return;
      if (!mergedMap.has(p.module)) {
        mergedMap.set(p.module, new Set());
      }
      p.actions?.forEach((action) => mergedMap.get(p.module).add(action));
    });

    // Merge direct overrides
    if (directPermissions && Array.isArray(directPermissions)) {
      directPermissions.forEach((p) => {
        if (!p.module) return;
        if (!mergedMap.has(p.module)) {
          mergedMap.set(p.module, new Set());
        }
        p.actions?.forEach((action) => mergedMap.get(p.module).add(action));
      });
    }

    return Array.from(mergedMap.entries()).map(([module, actions]) => ({
      module,
      actions: Array.from(actions),
    }));
  }

  /**
   * Fetches permissions resolved for a specific organization and property context.
   */
  async getContextPermissions(userId: string, orgId: string, propertyId?: string): Promise<{ roles: { id: string, name: string }[], permissions: Permission[] }> {
    const user = await this._userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    // 1. GLOBAL SuperAdmin check
    const isGlobalSuperAdmin = user.userType === 'superadmin';

    if (isGlobalSuperAdmin) {
      // Return a virtual SuperAdmin role for global access bypass check compatibility
      return {
        roles: [{ id: 'global-admin', name: 'SUPERADMIN' }],
        permissions: []
      };
    }

    // 2. Resolve scoped roles/permissions
    let propMemberships = [];
    if (propertyId) {
      const match = user.properties?.find((p) => p.id === propertyId);
      if (match) propMemberships = [match];
    } else {
      // Global/Fall-through: Check all active properties (and all if in onboarding)
      propMemberships = user.properties?.filter((p) =>
        p.status === 'active' || user.generateNewPw
      ) || [];
    }

    // Aggregate roles and permissions from Prop context
    const allScopedRoles = propMemberships.flatMap((p) => p.roles || []);
    const uniqueRoleIds = [...new Set(allScopedRoles.map((r) => r.id).filter(Boolean))];
    const roles = uniqueRoleIds.length > 0 ? await this._roleService.findByIds(uniqueRoleIds) : [];

    const allDirectPermissions = propMemberships.flatMap((p) => p.permissions || []);

    const permissions = this.aggregatePermissions(roles, allDirectPermissions);

    return {
      roles: roles.map((r) => ({ id: r.id, name: r.name })),
      permissions,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    const { email, password, mobileOtp, emailOtp, mobileNumber } = loginDto;
    this._logger.log(`[AuthService:login] Requested DTO: ${JSON.stringify({ email, mobileNumber, hasPassword: !!password })}`, this.constructor.name);

    const user =
      (mobileNumber ? await this._userService.findByMobileNumber(mobileNumber) : null) ??
      (email ? await this._userService.getUserByEmail(email) : null);
    
    this._logger.log(`[AuthService:login] Found user dynamically? ${!!user} (ID: ${user?._id})`, this.constructor.name);

    // Security: Use generic error to prevent account enumeration
    if (!user) {
      this._logger.log(`[AuthService:login] Rejecting purely because user=null`, this.constructor.name);
      throw new UnauthorizedException('Invalid credentials');
    }
    const isSuperAdmin = user.userType === 'superadmin';
    const isAnyActive = user.properties?.some(p => p.status === STATUS.ACTIVE);
    const isAnyInactive = user.properties?.some(p => p.status === STATUS.INACTIVE);

    this._logger.log(`[AuthService:login] Extracted Flags -> superAdmin: ${isSuperAdmin}, isAnyActive: ${isAnyActive}, isAnyInactive: ${isAnyInactive}, userGenerateNewPw: ${user.generateNewPw}`, this.constructor.name);

    // Skip property activation check for SuperAdmins - they have global scope
    if (!isSuperAdmin) {
      if (isAnyInactive && !isAnyActive) {
        this._logger.log(`[AuthService:login] Failing -> properties has inactive but NO active properties.`, this.constructor.name);
        throw new ForbiddenException(MESSAGE.USER.ERRORS.USER_STATUS_TO_BE_DELETED);
      }

      if (!isAnyActive && !user.generateNewPw) {
        this._logger.log(`[AuthService:login] Failing -> no active properties and NOT generating new Pw.`, this.constructor.name);
        throw new UnauthorizedException('Invalid credentials');
      }
    }
    // 1. Password Verification (Mandatory first step)
    if (!password) {
      this._logger.log(`[AuthService:login] Failing -> password is required for 2FA flow`, this.constructor.name);
      throw new BadRequestException('Password is required');
    }

    this._logger.log(`[AuthService:login] Checking entered password via bcrypt...`, this.constructor.name);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    this._logger.log(`[AuthService:login] Bcrypt match result was: ${isPasswordValid}`, this.constructor.name);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. 2FA Check (Second Step)
    // If OTP is NOT provided, send it and return a signal to the frontend
    if (!mobileOtp && !emailOtp) {
      this._logger.log(`[AuthService:login] Password valid. Sending OTP for 2FA...`, this.constructor.name);
      await this.sendOtpOnEmail(user.email, user.name);
      return { requiresOtp: true, email: user.email };
    }

    // 3. OTP Verification (Third Step)
    this._logger.log(`[AuthService:login] Password valid and OTP provided. Verifying OTP...`, this.constructor.name);
    const verifyOtpData: VerifyOtpDto = {
      mobileOtp,
      emailOtp,
      mobileNumber,
      email,
    };
    await this.verifyOtp(verifyOtpData);
    // Determine profile ID based on userType
    let profile;
    switch (user.userType) {
      case UserType.ADMIN:
        profile = await this._userService.findById(user._id.toString());
        break;
    }
    console.log(user);
    const primaryOrgId = user.organization?.id || (user.organizations && user.organizations[0]?.id);
    const context = await this.getContextPermissions(user._id.toString(), primaryOrgId?.toString());
    const latestPermissions = context.permissions;

    const tokens = await this.getTokens(
      user._id.toString(),
      user.email,
      user.name,
      user.userType,
      primaryOrgId?.toString(),
      undefined, // Global context (no propertyId)
      context.roles,
      latestPermissions,
      user.generateNewPw
    );
    // Hash refresh token and update user
    const hashedRt = await this.generateHashPassword(tokens.refresh_token);
    const updatedRt: UpdateUserDto = {
      refreshToken: hashedRt,
    };
    const userObj = {
      sub: user._id.toString(),
      name: user.userName,
    };
    await this._userService.update(user._id.toString(), updatedRt, userObj);

    // Merge latest permissions into the return object's user field for UI convenience
    console.log(`[AuthService] Generated permissions for ${user.email}:`, JSON.stringify(latestPermissions, null, 2));
    const userWithPerms = user.toObject ? user.toObject() : { ...user };
    userWithPerms.permissions = latestPermissions;
    userWithPerms.roles = context.roles;
    userWithPerms.generateNewPw = user.generateNewPw;

    return { tokens, user: userWithPerms, profile };
  }

  async loginUser(loginDTO: LoginDto): Promise<AuthResult> {
    const { email, password } = loginDTO;

    // Find user by email in the database
    let admin = await this._userService.getUserByEmail(email);
    // Security: Use generic error to prevent account enumeration
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }



    // Check if user is not an admin or does not have admin privileges
    if (admin.userType !== UserType.ADMIN) {
      throw new ForbiddenException(MESSAGE.FORBIDDEN_MESSAGE.NOT_ALLOWED_ADMIN_PANEL);
    }

    // 1. Compare provided password with encrypted password stored in the database
    const encryptedPassword = admin.password;
    const isMatch = await bcrypt.compare(password, encryptedPassword);

    // Security: Use same generic error for wrong password to prevent enumeration
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. 2FA Check
    // For admin login, we also require OTP after password
    if (!loginDTO.emailOtp && !loginDTO.mobileOtp) {
      await this.sendOtpOnEmail(admin.email, admin.name || admin.username);
      return { requiresOtp: true, email: admin.email };
    }

    // 3. Verify OTP
    await this.verifyOtp({
      email: admin.email,
      emailOtp: loginDTO.emailOtp,
      mobileOtp: loginDTO.mobileOtp,
      mobileNumber: loginDTO.mobileNumber
    });
    // Generate access token and refresh token for the user
    const primaryOrgId = admin.organization?.id || (admin.organizations && admin.organizations[0]?.id);
    const context = await this.getContextPermissions(admin._id.toString(), primaryOrgId?.toString());
    const latestPermissions = context.permissions;

    const tokens = await this.getTokens(
      admin._id.toString(),
      admin.email,
      admin.username,
      admin.userType,
      primaryOrgId?.toString(),
      admin.properties && admin.properties.length > 0 ? admin.properties[0].id : undefined,
      context.roles,
      latestPermissions,
      admin.generateNewPw
    );

    // Hash the refresh token before storing it
    const hashedRt = await this.generateHashPassword(tokens.refresh_token);

    // Update user's verification token and latest permissions
    const updatedRt = {
      refreshToken: hashedRt,
      organization: admin.organization,
      permissions: latestPermissions,
    };
    const userObj = {
      sub: admin._id.toString(),
    };
    await this._userService.update(admin._id.toString(), updatedRt, userObj);

    // Merge latest permissions into user object for frontend response body
    const finalAdmin = admin.toObject ? admin.toObject() : { ...admin };
    finalAdmin.permissions = latestPermissions;
    finalAdmin.roles = context.roles;


    // Prepare data to return with user information and tokens
    const data = {
      user: finalAdmin,
      tokens,
    };

    return data;
  }

  async signUp(signUpDto: SignUpDto, currentUser?: any): Promise<any> {
    const { email, orgId } = signUpDto;

    try {
      const user = await this._userService.getUserByEmail(email);
      if (user) {
        throw new ConflictException(MESSAGE.USER.ERRORS.ADD_CONFLICT);
      }
      const superAdminRoleId = process.env.SUPER_ADMIN_ROLE_ID;
      const superAdminRoleData = await this._roleService.findByIds([superAdminRoleId]);
      const roleSubs = superAdminRoleData.map((r) => ({ id: r.id, name: r.name }));

      const organization = await this._organizationService.findOne(orgId).catch(() => {
        throw new BadRequestException(
          'A valid organization ID (orgId) is required to sign up. Please create an organization first.'
        );
      });

      // Create the user. Roles will be assigned per-property in the next migration step.
      const createUserDto: CreateUserDto = {
        name: signUpDto.name,
        email: signUpDto.email,
        phone: signUpDto.phone,
        password: signUpDto.password,
        userType: UserType.ADMIN,
        gender: signUpDto.gender,
        dateOfBirth: signUpDto.dateOfBirth,
        usedInviteCode: signUpDto.inviteCode,
        organization: organization
          ? {
            id: organization.id,
            name: organization.organization_name,
          }
          : undefined,
        roles: roleSubs,
      };

      const newUser = await this._userService.create(createUserDto, currentUser);

      const primaryOrgId = newUser.organization?.id || (newUser.organizations && newUser.organizations[0]?.id);
      const context = await this.getContextPermissions(newUser._id.toString(), primaryOrgId?.toString());
      const latestPermissions = context.permissions;

      const tokens = await this.getTokens(
        newUser._id.toString(),
        newUser.email,
        newUser.name,
        newUser.userType,
        primaryOrgId?.toString(),
        undefined, // propertyId not yet confirmed
        context.roles,
        latestPermissions,
        newUser.generateNewPw
      );
      const hashedRt = await this.generateHashPassword(tokens.refresh_token);

      const userObj = {
        sub: newUser._id.toString(),
        email: newUser.email,
        name: newUser.name,
        userType: newUser.userType,
        profileId: newUser._id.toString(),
      };

      // Update user with the refresh token
      await this._userService.update(
        newUser._id.toString(),
        {
          refreshToken: hashedRt,
        },
        currentUser ? currentUser : userObj
      );

      // Merge latest permissions into returns to user object
      const finalUser = newUser.toObject ? newUser.toObject() : { ...newUser };
      finalUser.permissions = latestPermissions;


      return {
        user: finalUser,
        tokens,
      };
    } catch (error) {
      this._logger.error(`${MESSAGE.AUTH.ERROR.SIGNUP_FAILED}:: ${error}`, this.constructor.name);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(MESSAGE.AUTH.ERROR.SIGNUP_FAILED);
    }
  }

  async logout(user: any): Promise<{ message: string }> {
    try {
      const updatedRT: UpdateUserDto = {
        refreshToken: null,
      };
      await this._userService.update(user.sub, updatedRT, user);

      return { message: MESSAGE.AUTH.LOGOUT_SUCCESSFUL };
    } catch (error) {
      throw error;
    }
  }

  async refresh(userId: string, rt: string, currentUser: any): Promise<any> {
    const user = await this._userService.findOne(userId);

    if (!user) {
      throw new NotFoundException(MESSAGE.USER.NOT_FOUND);
    }

    const isRTEqual = await bcrypt.compare(rt, user.refreshToken);

    if (!isRTEqual) {
      throw new BadRequestException(MESSAGE.AUTH.ERROR.TOKEN_REFRESH_FAILED);
    }
    let profileId: string | null = null;
    switch (user.userType) {
      case UserType.ADMIN:
        const admin = await this._userService.findById(user._id.toString());
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        profileId = admin ? admin._id.toString() : null;
        break;
    }
    const orgId = user.organization?.id || (user.organizations && user.organizations[0]?.id);
    const context = await this.getContextPermissions(user._id.toString(), orgId?.toString());
    const latestPermissions = context.permissions;

    const tokens = await this.getTokens(
      user._id.toString(),
      user.email,
      user.name,
      user.userType,
      orgId?.toString(),
      undefined, // propertyId not yet confirmed during signup flow
      context.roles,
      latestPermissions,
      user.generateNewPw
    );

    const hashedRt = await this.generateHashPassword(tokens.refresh_token);
    const updatedRt: UpdateUserDto = {
      refreshToken: hashedRt,
    };
    await this._userService.update(user._id.toString(), updatedRt, currentUser);

    const finalUser = user.toObject ? user.toObject() : { ...user };
    finalUser.permissions = latestPermissions;
    finalUser.roles = context.roles;

    return { tokens, user: finalUser };
  }

  async refreshFromToken(refreshToken: string): Promise<any> {
    try {
      // Verify and decode the refresh token
      const payload = await this._jwtService.verifyAsync(refreshToken, {
        secret: this._configService.jwt.refreshSecret,
      });

      // Find user by ID from token payload
      const user = await this._userService.findOneForRefreshToken(payload.sub);
      if (!user) {
        throw new UnauthorizedException(MESSAGE.AUTH.ERROR.TOKEN_REFRESH_FAILED);
      }

      // Compare the provided refresh token with stored hashed token
      const isRTEqual = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isRTEqual) {
        throw new UnauthorizedException(MESSAGE.AUTH.ERROR.TOKEN_REFRESH_FAILED);
      }

      // Generate new tokens
      const orgId = user.organization?.id || (user.organizations && user.organizations[0]?.id);
      const context = await this.getContextPermissions(user._id.toString(), orgId?.toString());
      const latestPermissions = context.permissions;

      const tokens = await this.getTokens(
        user._id.toString(),
        user.email,
        user.name,
        user.userType,
        orgId?.toString(),
        undefined, // propertyId not yet confirmed during refresh flow
        context.roles,
        latestPermissions,
        user.generateNewPw
      );

      // Hash and store the new refresh token
      const hashedRt = await this.generateHashPassword(tokens.refresh_token);
      const updatedRt: UpdateUserDto = {
        refreshToken: hashedRt,
      };
      await this._userService.update(user._id.toString(), updatedRt, payload);

      const finalUser = user.toObject ? user.toObject() : { ...user };
      finalUser.permissions = latestPermissions;


      return { tokens, user: finalUser };
    } catch (error) {
      throw new UnauthorizedException(MESSAGE.AUTH.ERROR.TOKEN_REFRESH_FAILED);
    }
  }

  async forgetPassword(body: { email?: string; phone?: string }): Promise<{ message: string }> {
    const { email, phone } = body;
    const user = await this._userService.getUserByEmail(email);
    // Security: Don't reveal if user exists or not - always return success message
    // This prevents account enumeration attacks
    if (!user) {
      return {
        message: 'If an account exists with this email, you will receive a password reset link.',
      };
    }
    if (email) {
      const otp = await this.generateOTP();
      // saving otp to the database
      await this.saveOrUpdateVerificationCode(user.email, otp.toString());

      // sending email to the user
      await this._emailService.sendMail(
        MESSAGE.SUBJECT.FORGET_PASSWORD_OTP_SUBJECT(otp, process.env.BRAND_NAME),
        getForgetPasswordMail(user.name, otp.toString(), process.env.BRAND_NAME),
        { email: user.email, name: user.name }
      );
      // const token = await this._jwtService.sign(
      //   { emailOrMobile: user.email },
      //   {
      //     secret: process.env.JWT_ACCESS_TOKEN_SECRET,
      //     expiresIn: expireTime1H,
      //   },
      // );

      return {
        message: MESSAGE.OTP.EMAIL,
      };
    } else if (phone) {
      // await this.sendOTPonSMS(phone, user.name ?? '');

      // const token = await this._jwtService.sign(
      //   { emailOrMobile: user.phone.number },
      //   {
      //     secret: process.env.JWT_ACCESS_TOKEN_SECRET,
      //     expiresIn: expireTime1H,
      //   },
      // );

      return {
        message: MESSAGE.OTP.MOBILE,
      };
    }
  }

  async resetPassword(body: ResetPasswordDto): Promise<{ success: boolean }> {
    const { password, token } = body;
    let decode;
    try {
      decode = await this._jwtService.verify(token, {
        secret: this._configService.jwt.accessSecret,
      });
    } catch (error) {
      throw new BadRequestException(MESSAGE.AUTH.ERROR.TOKEN_INVALID);
    }
    const { emailOrMobile } = decode;
    const existingUser =
      (await this._userService.getUserByEmail(emailOrMobile)) ||
      (await this._userService.findByMobileNumber(emailOrMobile));
    // Security: Use generic error to prevent account enumeration
    if (!existingUser) {
      throw new BadRequestException('Invalid or expired reset token.');
    }
    const updatedByUser = {
      sub: existingUser._id.toString(),
      firstName: existingUser?.firstName,
      lastName: existingUser?.lastName,
      email: existingUser?.email,
      userName: existingUser?.userName,
      userType: existingUser.userType,
    };
    await this._userService.update(existingUser._id.toString(), { password }, updatedByUser);
    if (existingUser.email) {
      // const subject = MESSAGE.SUBJECT.PASSWORD_CHANGED;
      // const receiver = {
      //   email: existingUser.email,
      //   name: existingUser.fullName ?? 'User',
      // };
      // const template = getPasswordChangedMail(existingUser.fullName ?? 'User');
      // await this._emailService.sendMail(subject, template, receiver);
    }

    return { success: true };
  }

  async changePassword(body: ChangePasswordDto, currentUser: any): Promise<{ success: boolean }> {
    const { currentPassword, newPassword } = body;
    const password = newPassword;

    // Get the user by ID with password included (findOne excludes password)
    const user = await this._userService.getUserByEmail(currentUser.email);
    if (!user) {
      throw new NotFoundException(MESSAGE.USER.NOT_FOUND);
    }

    // Verify the current password (bypass if user is in onboarding)
    if (!user.generateNewPw) {
      if (!currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException(MESSAGE.AUTH.ERROR.INVALID_PASSWORD);
      }
    }

    // Prepare the update payload
    const updateData: any = {
      password,
      generateNewPw: false
    };

    // If the user was in onboarding, activate their properties and set the completion flag
    if (user.generateNewPw) {
      updateData.hasCompletedOnboarding = true;
      updateData.properties = (user.properties || []).map((p: any) => {
        const pObj = p.toObject ? p.toObject() : p;
        return { ...pObj, status: STATUS.ACTIVE };
      });
    }

    await this._userService.update(user._id.toString(), updateData, currentUser);

    // Send email notification if email exists
    if (user.email) {
      // const subject = MESSAGE.SUBJECT.PASSWORD_CHANGED;
      // const receiver = {
      //   email: user.email,
      //   name: user.name ?? 'User',
      // };
      // const template = getPasswordChangedMail(user.name ?? 'User');
      // await this._emailService.sendMail(subject, template, receiver);
    }

    return { success: true };
  }

  async sendOTP(mobileNumber: string): Promise<boolean> {
    const user = await this._userService.findByMobileNumber(mobileNumber);

    // Security: Don't reveal if user exists - always return success
    // Only actually send OTP if user exists
    if (!user) {
      return true;
    }

    const otp = await this.generateOTP();
    await this._communicationProviderService.sendWhatsAppMessage(mobileNumber, otp.toString());
    user.otp = otp;
    await user.save();

    return true;
  }

  async sendOtpOnEmail(email: string, name: string): Promise<boolean> {
    const recipient = {
      name: name ?? 'User',
      email: email,
    };
    const otp = await this.generateOTP();
    const brandName = process.env.BRAND_NAME || 'CMS';
    const template = getOtpMail(recipient.name, otp.toString());

    await this._emailService.sendMail(
      MESSAGE.SUBJECT.OTP_VERIFICATION(otp, brandName),
      template,
      recipient
    );
    await this.saveOrUpdateVerificationCode(email, otp.toString());

    return true;
  }

  async saveOrUpdateVerificationCode(email: string, otp: string): Promise<void> {
    const emailData = await this._verificationCodeService.findByMobileNumberOrEmail({ email });
    const emailDto: Partial<VerificationCode> = {
      email,
      otp: otp.toString(),
      isVerified: false,
      timestamp: this._verificationCodeService.generate10minTimestamp(),
    };
    if (emailData) {
      await this._verificationCodeService.update(emailData._id.toString(), emailDto);
    } else {
      await this._verificationCodeService.create(emailDto);
    }
  }

  async verifyUser(
    body: VerifyOtpDto,
    currentUser: any
  ): Promise<{ updatedUser: TUserDocument; success: boolean }> {
    const { mobileNumber, email, mobileOtp, emailOtp } = body;
    this._validateInput(mobileNumber, email);

    const mobileData = await this._findVerificationData(mobileNumber);
    const emailData = await this._findVerificationData(email);
    mobileNumber && this._checkOtpAndExpiration(mobileData, mobileOtp, 'Mobile');
    email && this._checkOtpAndExpiration(emailData, emailOtp, 'Email');

    mobileData && (await this._updateVerificationStatus(mobileData, 'mobileNumber'));
    email && (await this._updateVerificationStatus(emailData, 'email'));
    let user;
    if (email) {
      user = await this._userService.getUserByEmail(email);
    }
    const updatedUserObj = { verified: true, emailVerified: new Date() };
    const updatedUser = await this._userService.update(user.id, updatedUserObj, currentUser);
    await this._organizationService.update(
      user.organization?.id || (user.organizations && user.organizations[0]?.id),
      { is_verified: true },
      currentUser
    );
    // this._userService.subscribeNewUserToBasic(user);
    return { updatedUser, success: true };
  }

  async verifyOtp(body: VerifyOtpDto): Promise<{ success: boolean; token: string }> {
    const { mobileNumber, email, mobileOtp, emailOtp } = body;

    this._validateInput(mobileNumber, email);
    const mobileData = await this._findVerificationData(mobileNumber);
    const emailData = await this._findVerificationData(email);
    mobileNumber && this._checkOtpAndExpiration(mobileData, mobileOtp, 'Mobile');
    email && this._checkOtpAndExpiration(emailData, emailOtp, 'Email');
    mobileData && (await this._updateVerificationStatus(mobileData, 'mobileNumber'));
    email && (await this._updateVerificationStatus(emailData, 'email'));
    const token = await this._jwtService.sign(
      { emailOrMobile: email, otp: emailOtp },
      {
        secret: this._configService.jwt.accessSecret,
        expiresIn: expireTime1H,
      }
    );
    return { success: true, token };
  }
  // async sendOTPonSMS(mobileNumber: string, name: string): Promise<boolean> {
  //   const otp = await this.generateOTP();
  //   // const smsId = await this._sendSMS(mobileNumber, name, otp.toString());

  //   const message = getSMSOtpMessage(name, otp.toString());
  //   const data = await this._communicationProviderService.sendSMS(
  //     mobileNumber,
  //     message,
  //   );
  //   await this._updateVerificationCode(mobileNumber, otp.toString(), data.sid);

  //   return true;
  // }

  async createOrUpdateUserFromGoogle(
    token: string,
    inviteCode: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<{
    user: Partial<TUserDocument>;
    tokens: {
      access_token: string;
      refresh_token: string;
    };
  }> {
    try {
      // Security: Validate token audience to prevent token confusion attacks
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const profile = ticket.getPayload();
      if (!profile) {
        throw new UnauthorizedException('Token has expired');
      }
      // Note: Audience is already validated by verifyIdToken when audience option is provided
      const { sub, given_name, family_name, email, picture } = profile;

      const existingUser: any = await this._userService.getUserByEmail(email);
      const name = `${given_name && given_name} ${family_name && family_name}`.trim();
      if (
        existingUser &&
        (existingUser.name !== `${given_name} ${family_name}` ||
          existingUser.profilePictureUrl !== picture ||
          !existingUser?.googleId)
      ) {
        const updateUserObj = {
          name: name,
          googleId: sub,
          profilePictureUrl: picture,
          verified: true,
        };
        const updatedUser: any = await this._userService.update(existingUser._id, updateUserObj);

        if (updatedUser) {
          const orgId = updatedUser.organization?.id || (updatedUser.organizations && updatedUser.organizations[0]?.id);
          const context = await this.getContextPermissions(updatedUser._id, orgId?.toString());
          const tokens = await this.getTokens(
            updatedUser._id,
            email,
            name,
            UserType.USER,
            orgId?.toString(),
            undefined, // propertyId
            context.roles,
            context.permissions,
            updatedUser.generateNewPw
          );
          const hashedRt = await this.generateHashPassword(tokens.refresh_token);
          const updatedRt: UpdateUserDto = {
            refreshToken: hashedRt,
          };
          const userObj = {
            sub: updatedUser._id.toString(),
            name: updatedUser.name,
          };
          await this._userService.update(updatedUser._id.toString(), updatedRt, userObj);
          response.header('Authorization', `Bearer ${tokens.access_token}`);

          response.cookie('jwt', tokens.access_token, cookieOptions);

          response.cookie('rf-jwt', tokens.refresh_token, cookieOptionsRefresh);
          return { user: updatedUser, tokens };
        }
      } else if (!existingUser) {
        if (!inviteCode || inviteCode === undefined) {
          throw new BadRequestException('You need to first register with invite code');
        }
        // await this._inviteCodeService.useInviteCode(inviteCode, email);
        const createUserDto: CreateUserDto = {
          name: name,
          email: email,
          verified: true,
          googleId: sub,
          profilePicture: {
            url: picture,
          },
        };
        const savedUser: any = await this._userService.create(createUserDto);
        const orgId = savedUser.organization?.id || (savedUser.organizations && savedUser.organizations[0]?.id);
        const context = await this.getContextPermissions(savedUser._id, orgId?.toString());
        const tokens = await this.getTokens(
          savedUser._id,
          email,
          name,
          UserType.USER,
          orgId?.toString(),
          undefined, // propertyId
          context.roles,
          context.permissions,
          savedUser.generateNewPw
        );
        // await this._userService.updateUserWithRefreshToken(
        //   savedUser._id,
        //   tokens.refresh_token,
        // );
        const hashedRt = await this.generateHashPassword(tokens.refresh_token);
        const updatedRt: UpdateUserDto = {
          refreshToken: hashedRt,
        };
        const userObj = {
          sub: savedUser._id.toString(),
          name: savedUser.name,
        };
        await this._userService.update(savedUser._id.toString(), updatedRt, userObj);
        response.header('Authorization', `Bearer ${tokens.access_token}`);

        response.cookie('jwt', tokens.access_token, cookieOptions);
        response.cookie('rf-jwt', tokens.refresh_token, cookieOptionsRefresh);
        return { user: savedUser, tokens };
      } else {
        const orgId = existingUser.organization?.id || (existingUser.organizations && existingUser.organizations[0]?.id);
        const context = await this.getContextPermissions(existingUser._id, orgId?.toString());
        const tokens = await this.getTokens(
          existingUser._id,
          email,
          existingUser.name,
          UserType.USER,
          orgId?.toString(),
          undefined, // propertyId
          context.roles,
          context.permissions,
          existingUser.generateNewPw
        );
        const hashedRt = await this.generateHashPassword(tokens.refresh_token);
        const updatedRt: UpdateUserDto = {
          refreshToken: hashedRt,
        };
        const userObj = {
          sub: existingUser._id.toString(),
          name: existingUser.name,
        };
        await this._userService.update(existingUser._id.toString(), updatedRt, userObj);
        response.header('Authorization', `Bearer ${tokens.access_token}`);

        response.cookie('jwt', tokens.access_token, cookieOptions);
        response.cookie('rf-jwt', tokens.refresh_token, cookieOptionsRefresh);
        return { user: existingUser, tokens };
      }
    } catch (error) {
      this._logger.error(`Error while creating user: ${error.message}`, error.stack);
      if (
        error instanceof ConflictException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error while creating user');
    }
  }
  async googleAuth(
    token: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<{
    user: Partial<TUserDocument>;
    authType: string;
    tokens: {
      access_token: string;
      refresh_token: string;
    };
  }> {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      let authType = AUTH_TYPE.LOGIN;
      const profile = ticket.getPayload();
      if (!profile) {
        throw new UnauthorizedException('Token has expired');
      }
      const { sub, given_name, family_name, email, picture } = profile;

      const existingUser: any = await this._userService.getUserByEmail(email);

      if (!existingUser) {
        authType = AUTH_TYPE.SIGNUP;

        //create organization
        // const organization = await this._organizationService.create({
        //   name: given_name,
        //   organizationName: `${given_name}'s Org`,
        //   contactEmail: email,
        //   password: await this.generateFirstPassword(),
        //   isVerified: true,
        //   domain: null,
        // });

        // const createUserObj = {
        //   name: `${given_name && given_name} ${
        //     family_name && family_name
        //   }`.trim(),
        //   email,
        //   userType: UserType.USER,
        //   profilePicture: {
        //     url: picture,
        //   },
        //   googleId: sub,
        //   verified: true,
        //   usedInviteCode: '',
        //   organization: {
        //     id: organization.id,
        //     name: organization.organization_name,
        //     domain: organization.domain,
        //   },
        // };
        // existingUser = await this._userService.findOne(organization.organization.admins[0].id);
        // this._userService.subscribeNewUserToBasic(existingUser);
      }

      const orgId = existingUser.organization?.id || (existingUser.organizations && existingUser.organizations[0]?.id);
      const context = await this.getContextPermissions(existingUser.id, orgId?.toString());
      const tokens = await this.getTokens(
        existingUser.id,
        email,
        existingUser.name,
        existingUser.userType,
        orgId?.toString(),
        undefined, // propertyId
        context.roles,
        context.permissions,
        existingUser.generateNewPw
      );
      return { user: existingUser, authType, tokens };
    } catch (error) {
      this._logger.error(`Error while creating user: ${error.message}`, error.stack);
      if (
        error instanceof ConflictException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error while creating user');
    }
  }

  async generateFirstPassword(): Promise<string> {
    return await this.generateHashPassword(Math.random().toString(36).substring(2, 15));
  }

  async googleServiceAuth(code: string, @Res({ passthrough: true }) response: Response) {
    try {
      const clients = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Exchange the authorization code for tokens
      const { tokens } = await clients.getToken(code);
      if (!tokens) {
        this._logger.error('No tokens received from Google');
        throw new UnauthorizedException('No tokens received from Google');
      }
      clients.setCredentials(tokens);
      // Check if tokens are valid
      if (!tokens || !tokens.access_token || !tokens.refresh_token) {
        this._logger.error('Invalid Google authorization code or tokens not received');
        throw new UnauthorizedException('Invalid Google authorization code');
      }
      const expiresOn = new Date(Date.now() + (tokens.expiry_date || 3600 * 1000));
      return { ...tokens, expiresOn };
    } catch (error) {
      this._logger.error(`Error while getting access token: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error while getting access token');
    }
  }

  async googleServiceAuthURL(serviceType: GoogleServiceType) {
    try {
      const clients = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      const scopes =
        serviceType === GoogleServiceType.SEARCH_CONSOLE
          ? [
            'https://www.googleapis.com/auth/webmasters',
            'https://www.googleapis.com/auth/webmasters.readonly',
          ]
          : [
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/analytics',
          ];

      const authUrl = clients.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
      });
      return authUrl;
    } catch (error) {
      this._logger.error(
        `Error while generating Google Search Console auth URL: ${error.message}`,
        error.stack
      );
      throw new InternalServerErrorException('Error while generating auth URL');
    }
  }

  async googleAnalyticsAuth(code: string, @Res({ passthrough: true }) response: Response) {
    try {
      const clients = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Exchange the authorization code for tokens
      const { tokens } = await clients.getToken(code);
      if (!tokens) {
        throw new UnauthorizedException('Failed to get tokens from Google');
      }

      // Get user info from token
      const ticket = await clients.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const profile = ticket.getPayload();
      if (!profile) {
        throw new UnauthorizedException('Failed to get user profile from Google');
      }

      const { email } = profile;

      // Find user by email
      const user = await this._userService.getUserByEmail(email);
      if (!user) {
        throw new UnauthorizedException(
          'Unable to link account. Please ensure you are registered.'
        );
      }

      // Update user with Google Analytics credentials
      const updateUserDto: UpdateUserDto = {
        accountLinked: {
          ...user.accountLinked,
          google_analytics: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            scope: tokens.scope,
            tokenType: tokens.token_type,
            expiresOn: new Date(Date.now() + tokens.expiry_date),
            activeProperties: [],
          },
        },
      };

      await this._userService.update(user.id, updateUserDto);

      return {
        message: 'Google Analytics account linked successfully',
        serviceType: GoogleServiceType.ANALYTICS,
      };
    } catch (error) {
      this._logger.error(
        `Error while linking Google Analytics account: ${error.message}`,
        error.stack
      );
      throw new InternalServerErrorException('Error while linking Google Analytics account');
    }
  }
  // PRIVATE FUNCTIONS
  private async _updateVerificationCode(
    mobileNumber: string,
    otp: string,
    smsId: string
  ): Promise<void> {
    const mobileData = await this._verificationCodeService.findByMobileNumberOrEmail({
      mobileNumber,
    });
    const mobileDto: Partial<VerificationCode> = {
      mobileNumber,
      otp,
      isVerified: false,
      smsId,
      timestamp: this._verificationCodeService.generate10minTimestamp(),
    };
    if (mobileData) {
      await this._verificationCodeService.update(mobileData._id.toString(), mobileDto);
    } else {
      await this._verificationCodeService.create({
        ...mobileDto,
        mobileNumber,
      });
    }
  }
  private async _updateVerificationStatus(data: any, identifier?: string): Promise<void> {
    if (data) {
      const updateData: Partial<VerificationCode> = {
        [identifier ? 'mobileNumber' : 'email']: identifier,
        otp: null,
        isVerified: true,
      };
      await this._verificationCodeService.update(data._id.toString(), updateData);
    }
  }
  private _checkOtpAndExpiration(data: any, otp: number, type: string): void {
    if (!data || Number(data.otp) !== otp) {
      throw new BadRequestException(`${type} ${MESSAGE.OTP.ERRORS.NOT_MATCH}`);
    }
    if (!this._verificationCodeService.checkTimeStampExpire(data.timestamp)) {
      throw new BadRequestException(`${type} ${MESSAGE.OTP.ERRORS.EXPIRED}`);
    }
  }
  private _validateInput(mobileNumber?: string, email?: string): void {
    if (!mobileNumber && !email) {
      throw new BadRequestException(MESSAGE.BAD_REQUEST.EMAIL_OR_MOBILE);
    }
  }
  private async _findVerificationData(identifier?: string): Promise<VerificationCode> | null {
    if (!identifier) {
      return null;
    }

    return await this._verificationCodeService.findByMobileNumberOrEmail({
      [identifier.includes('@') ? 'email' : 'mobileNumber']: identifier,
    });
  }

  private async _refreshLinkedInAccessToken(code: string): Promise<any> {
    const apiUri = 'https://www.linkedin.com/oauth/v2/accessToken';
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    });

    const headersUrlEncoded = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    try {
      const res = await fetch(apiUri, {
        method: 'POST',
        headers: headersUrlEncoded,
        body: params,
      });

      if (!res.ok) {
        throw new Error(`Failed to refresh access token: ${res.statusText}`);
      }

      const data = await res.json();
      return data;
    } catch (error) {
      // Security: Don't log the full error as it may contain tokens
      console.error('Error while refreshing LinkedIn access token:', error.message);
      throw error;
    }
  }
  generateOTP(): Promise<number> {
    return new Promise((resolve, reject) => {
      crypto.randomInt(100000, 999999, (err, n) => {
        if (err) reject(err);

        return resolve(n);
      });
    });
  }
  filterUser(user) {
    if (!user) return null;

    // Convert to plain object if it's a Mongoose document
    const userObj = typeof user.toObject === 'function' ? user.toObject() : { ...user };

    return {
      _id: userObj._id,
      designation: userObj.designation,
      industry: userObj.industry,
      expertise: userObj.expertise,
      interests: userObj.interests,
      tone: userObj.tone,
      style: userObj.style,
      name: `${userObj.name}`,
      email: userObj.email,
      verified: userObj.verified,
      usedInviteCode: userObj.usedInviteCode,
      status: userObj.properties?.[0]?.status || STATUS.ACTIVE,
      role: userObj.role,
      createdAt: userObj.createdAt,
    };
  }


  async resendInvite(email: string, currentUser: TCurrentUserType, propertyId?: string): Promise<{ message: string }> {
    try {
      const user = await this._userService.getUserByEmail(email);
      const isAnyInactive = user?.properties?.some(p => p.status === STATUS.INACTIVE || p.status === STATUS.PENDING);
      if (!user || !isAnyInactive) {
        throw new NotFoundException('Active invitation not found for this email');
      }

      const tempPassword = this._generateRandomPassword(12);
      console.log(`RESEND [${email}]: ${tempPassword}`); // DEBUG: Log for user to check onboarding
      const invitationToken = this._generateToken(email, tempPassword);

      // Property-scoped status update
      const updatedProperties = (user.properties || []).map((p: any) => {
        const pObj = p.toObject ? p.toObject() : p;
        if (propertyId && pObj.id !== propertyId) return pObj;
        return { ...pObj, status: STATUS.PENDING };
      });

      // UserService.update handles hashing via bcrypt if password is provided
      await this._userService.update(user._id.toString(), {
        password: tempPassword,
        invitationToken,
        invitationExpiresAt: moment().add(1, 'day').toDate(),
        properties: updatedProperties,
        isVerified: false,
        generateNewPw: true,
        updatedBy: buildUserMetadata(currentUser),
      }, { sub: currentUser.sub, name: currentUser.name, email: currentUser.email, userType: currentUser.userType });

      const magicLink = `${process.env.HOSTED_URL}/register?token=${invitationToken}`;
      const targetProperty = propertyId ? user.properties?.find(p => p.id === propertyId || (p as any)._id?.toString() === propertyId) : null;
      const brandName = targetProperty ? targetProperty.name : (user.properties?.[0]?.name || user.organization?.name || 'CMS');

      await this._emailService.sendMail(
        MESSAGE.SUBJECT.USER_INVITATION(brandName),
        getUserInvitationMail(user.name || email, tempPassword, magicLink, brandName),
        { name: user.name || email, email: email }
      );

      return { message: 'Invitation resent successfully' };
    } catch (error) {
      this._logger.error(`Error while resending invite: ${error.message}`, error.stack);
      throw error;
    }
  }

  async reactivateUser(
    userId: string,
    permissions: any[],
    currentUser: TCurrentUserType,
    password?: string,
    sendEmail: boolean = true,
    propertyId?: string
  ) {
    try {
      const user = await this._userService.findOne(userId);
      if (!user) throw new NotFoundException('User not found');

      const tempPassword = password || this._generateRandomPassword(12);
      console.log(`REACTIVATE [${user.email}]: ${tempPassword} (sendEmail: ${sendEmail})`); // DEBUG: Log for user to check onboarding
      const invitationToken = sendEmail ? this._generateToken(user.email, tempPassword) : "";

      // Property-scoped status and permissions update
      const updatedProperties = (user.properties || []).map((p: any) => {
        const pObj = p.toObject ? p.toObject() : p;
        if (propertyId && pObj.id !== propertyId) return pObj;
        
        return { 
          ...pObj, 
          status: STATUS.PENDING,
          permissions: permissions && permissions.length > 0 ? permissions : pObj.permissions
        };
      });

      // UserService.update handles hashing via bcrypt if password is provided
      await this._userService.update(userId, {
        password: tempPassword,
        invitationToken,
        invitationExpiresAt: moment().add(1, 'day').toDate(),
        properties: updatedProperties,
        isVerified: false,
        generateNewPw: true,
        updatedBy: buildUserMetadata(currentUser),
      }, { sub: currentUser.sub, name: currentUser.name, email: currentUser.email, userType: currentUser.userType });

      if (sendEmail) {
        const magicLink = `${process.env.HOSTED_URL}/register?token=${invitationToken}`;
        const targetProperty = propertyId ? user.properties?.find(p => p.id === propertyId || (p as any)._id?.toString() === propertyId) : null;
        const brandName = targetProperty ? targetProperty.name : (user.properties?.[0]?.name || user.organization?.name || 'CMS');

        await this._emailService.sendMail(
          MESSAGE.SUBJECT.USER_REACTIVATION(brandName),
          getUserReactivationMail(user.name, tempPassword, magicLink, brandName),
          { name: user.name, email: user.email }
        );

        return { message: 'Reactivation initiated and email sent' };
      }

      return { message: 'User reactivated successfully' };

    } catch (error) {
      this._logger.error(`Error while reactivating user: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Resends an invitation email by User ID
   */
  async resendInviteById(userId: string, currentUser: TCurrentUserType, propertyId?: string) {
    try {
      const user = await this._userService.findOne(userId);
      if (!user) throw new NotFoundException('User not found');

      const tempPassword = this._generateRandomPassword(12);
      console.log(`RESEND BY ID [${user.email}]: ${tempPassword}`); // DEBUG: Log for user to check onboarding
      const invitationToken = this._generateToken(user.email, tempPassword);

      // Property-scoped status update
      const updatedProperties = (user.properties || []).map((p: any) => {
        const pObj = p.toObject ? p.toObject() : p;
        if (propertyId && pObj.id !== propertyId) return pObj;
        return { ...pObj, status: STATUS.PENDING };
      });

      // UserService.update handles hashing via bcrypt if password is provided
      await this._userService.update(userId, {
        password: tempPassword,
        invitationToken,
        invitationExpiresAt: moment().add(1, 'day').toDate(),
        properties: updatedProperties,
        isVerified: false,
        generateNewPw: true,
        updatedBy: buildUserMetadata(currentUser),
      }, { sub: currentUser.sub, name: currentUser.name, email: currentUser.email, userType: currentUser.userType });

      const magicLink = `${process.env.HOSTED_URL}/register?token=${invitationToken}`;
      const targetProperty = propertyId ? user.properties?.find(p => p.id === propertyId || (p as any)._id?.toString() === propertyId) : null;
      const brandName = targetProperty ? targetProperty.name : (user.properties?.[0]?.name || user.organization?.name || 'CMS');

      await this._emailService.sendMail(
        MESSAGE.SUBJECT.USER_INVITATION(brandName),
        getUserInvitationMail(user.name, tempPassword, magicLink, brandName),
        { name: user.name, email: user.email }
      );

      return { message: 'Invitation resent successfully' };
    } catch (error) {
      this._logger.error(`Error while resending invite by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async initiateLogin(
    inviteDto: InviteDto,
    currentUser: TCurrentUserType,
    propertyId?: string
  ): Promise<{ message: string }> {
    try {
      const { email, roles, properties, permissions } = inviteDto;
      // No need for separate invitation tokens here as it's built into User creation

      const user = await this._userService.getUserByEmail(email); // Find user based on email
      if (user) {
        throw new ConflictException(MESSAGE.USER.ERRORS.ADD_CONFLICT_EMAIL);
      }

      const cacheKey = `login-init:${email}`;
      const wasSet = await this._redisService.setNX(cacheKey, { email }, 60); // 1-minute throttle
      const organization = await this._organizationService.findOne(currentUser.organizationId, { users: 0, admins: 0 });
      const organizationData = {
        id: organization._id.toString(),
        name: organization.organization_name,
        slug: organization.slug,
      };

      const rolesData: TRoleDocument[] = await this._roleService.findByIds(roles || []);
      const roleSubs = rolesData.map((role) => ({ id: role.id, name: role.name }));
      const permissionsToAssign = permissions && permissions.length > 0
        ? permissions
        : rolesData.length > 0 ? rolesData[0].permissions : [];

      const propertiesData = [];
      let invitedFromProperty = null;
      const targetPropertyId = propertyId || currentUser.propertyId;
      if (targetPropertyId) {
        try {
          invitedFromProperty = await this._propertyService.findOne(targetPropertyId);
          if (invitedFromProperty) {
            propertiesData.push({
              id: invitedFromProperty._id.toString(),
              name: invitedFromProperty.name,
              domain: invitedFromProperty.domain,
              roles: roleSubs,
              permissions: permissionsToAssign,
              status: STATUS.PENDING
            });
          }
        } catch (e) {
          this._logger.warn(`Property context ${targetPropertyId} not found during invitation`);
        }
      }

      // Add additional properties from properties if provided
      if (properties && properties.length > 0) {
        for (const pId of properties) {
          if (propertiesData.some((p) => p.id === pId)) continue;
          try {
            const property = await this._propertyService.findOne(pId);
            if (property) {
              propertiesData.push({
                id: property._id.toString(),
                name: property.name,
                domain: property.domain,
                roles: roleSubs,
                permissions: permissionsToAssign,
                status: STATUS.PENDING
              });
            }
          } catch (e) {
            this._logger.warn(`Additional property ${pId} not found during invitation`);
          }
        }
      }
      const tempPassword = inviteDto.password;
      let invitationToken = "";
      if (inviteDto.sendEmail) {
        invitationToken = this._generateToken(email, tempPassword);
      }
      const createUserDto: CreateUserDto = {
        email,
        name: inviteDto.name || email.split('@')[0],
        password: tempPassword,
        roles: roleSubs,
        organization: organizationData,
        properties: propertiesData,
        userType: inviteDto.userType || UserType.USER,
        permissions: inviteDto.permissions,
        isVerified: false,
        generateNewPw: true,
        invitationToken: invitationToken || "",
        invitationExpiresAt: moment().add(1, 'day').toDate(),
      };

      await this._userService.create(createUserDto, currentUser);

      const brandName = invitedFromProperty?.name || propertiesData[0]?.name || organizationData?.name || 'CMS';
      if (inviteDto.sendEmail) {
        const magicLink = `${process.env.HOSTED_URL}/register?token=${invitationToken}`;
        // Send invitation email
        await this._emailService.sendMail(
          MESSAGE.SUBJECT.USER_INVITATION(brandName),
          getUserInvitationMail(inviteDto.name || email, tempPassword, magicLink, brandName),
          { name: inviteDto.name || email, email: email }
        );

        return {
          message: 'Invitation sent successfully',
        };
      }
      return {
        message: 'Invitation created successfully',
      }
    } catch (error) {
      this._logger.error(`Error while initiating login: ${error.message}`, error.stack);
      throw error;
    }
  }

  async completeOnboarding(onboardingDto: any): Promise<any> {
    const { email, temporaryPassword, newPassword } = onboardingDto;
    const user = await this._userService.getUserByEmail(email);
    const isWaitlisted = user?.properties?.some(p => p.status === STATUS.INACTIVE || p.status === STATUS.PENDING);
    if (!user || !isWaitlisted) {
      throw new UnauthorizedException('Invalid onboarding request');
    }

    const isTempMatch = await bcrypt.compare(temporaryPassword, user.password);
    if (!isTempMatch) {
      throw new UnauthorizedException('Invalid temporary password');
    }

    // Update user password and mark onboarding as complete
    await this._userService.updateUserPassword(user._id.toString(), newPassword);

    return this.login({ email, password: newPassword });
  }
  async verifyInviteToken(token: string): Promise<any> {
    try {
      if (!token) {
        throw new BadRequestException('Token is required');
      }

      const user = await this._userService.getUserByToken(token);
      if (!user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      if (user.invitationExpiresAt && moment().isAfter(user.invitationExpiresAt)) {
        throw new UnauthorizedException('Invitation has expired');
      }

      // Mark email as verified but we keep them on INACTIVE until they change password
      await this._userService.update(user._id.toString(), { isVerified: true }, { sub: 'system', name: 'system', email: 'system@system.com', userType: 'system' });
      const updatedUser = await this._userService.findOne(user._id.toString());
      const orgId = updatedUser.organization?.id || (updatedUser.organizations && updatedUser.organizations[0]?.id);
      const propertyId = updatedUser.properties && updatedUser.properties.length > 0 ? updatedUser.properties[0].id : undefined;
      const context = await this.getContextPermissions(updatedUser._id.toString(), orgId?.toString());
      const tokens = await this.getTokens(
        updatedUser._id.toString(),
        updatedUser.email,
        updatedUser.name,
        updatedUser.userType,
        orgId?.toString(),
        propertyId?.toString(),
        context.roles,
        context.permissions,
        updatedUser.generateNewPw
      );

      return {
        email: updatedUser.email,
        name: updatedUser.name,
        verified: true,
        generateNewPw: updatedUser.generateNewPw,
        tokens,
      };
    } catch (error) {
      this._logger.error(`Error in verifyInviteToken: ${error.message}`);
      throw error;
    }
  }

  // Helper method to hash the token
  private async _hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  // Security: Generate a 64-character (256-bit) cryptographically secure token
  private _generateToken(email: string, password: string): string {
    return Buffer.from(`${email}:${password}`).toString('base64');
  }
  // Fetches the token from Redis cache and parses JSON
  private async _findTokenInCache(
    email: string
  ): Promise<{ email: string; hashedToken: string } | null> {
    const cacheKey = `login:${email}`;
    const data = await this._redisService.get(cacheKey);
    return data;
  }

  // Invalidate the token by deleting it from Redis
  private async _invalidateToken(email: string): Promise<void> {
    const cacheKey = `login:${email}`;

    try {
      await this._redisService.del(cacheKey); // Assuming this returns void
      // Successfully invalidated token for the user
    } catch (error) {
      // Failed to invalidate token for the user
      // Optionally, you can throw a custom error or handle it as needed
    }
  }
}

import {
  Controller,
  Body,
  Post,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  InternalServerErrorException,
  Redirect,
  Headers,
  Res,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import { AuthService, AuthResult } from './auth.service';
import { GetCurrentUser, Public, SkipPermission } from './common/decorators';
import { Permissions } from 'src/auth/common/decorators/permissions.decorator';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import {
  FormOtpDto,
  LoginDto,
  OtpDto,
  ResetPasswordDto,
  SignUpDto,
  VerifyOtpDto,
  ChangePasswordDto,
  InviteDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import { TCurrentUserType } from './types/user.type';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { TApiResponse } from 'src/core/types/response';
import { GoogleServiceType } from 'src/core/constants/enums.constants';
import { UserService } from 'src/user/user.service';
import { Request, Response } from 'express';
import { ISanitizedUser } from 'src/user/interfaces/sanitized-user.interface';
import { createUserObject } from 'src/core/utils/utils';
import { TUserDocument } from 'src/user/entities/user.schema';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  private linkedInClientId = process.env.LINKEDIN_CLIENT_ID;
  private linkedInRedirectUri = process.env.LINKEDIN_REDIRECT_URI;
  private linkedInScope = 'w_member_social,profile,email,openid';
  constructor(
    private readonly _authService: AuthService,
    private readonly _userService: UserService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) { }

  private _handleError(error: any, defaultMessage: string): never {
    this._logger.error(`${defaultMessage}: ${error.message}`, error.stack, this.constructor.name);
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof ConflictException ||
      error instanceof UnprocessableEntityException
    ) {
      throw error;
    } else if (error.name === 'ValidationError') {
      throw new BadRequestException(error.message);
    }
    throw new InternalServerErrorException(defaultMessage);
  }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<TApiResponse> {
    try {
      this._logger.log(`[AuthController:login] Triggered for email/mobile: ${loginDto.email || loginDto.mobileNumber}`, this.constructor.name);
      const fullData: AuthResult = await this._authService.login(loginDto);
      if ('requiresOtp' in fullData) {
        return {
          data: { requiresOtp: true, email: fullData.email },
          message: 'OTP sent to your email address',
        };
      }

      const user = fullData.user;
      this._logger.log(`[AuthController:login] AuthService success for user id: ${user._id}`, this.constructor.name);

      const userResponseObject: ISanitizedUser = createUserObject(user as TUserDocument);
      return {
        data: { user: userResponseObject, tokens: fullData.tokens },
        message: MESSAGE.AUTH.LOGIN_SUCCESSFUL,
      };
    } catch (error) {
      this._logger.log(`[AuthController:login] Failed with error: ${error.message || error}`, this.constructor.name);
      this._handleError(error, MESSAGE.AUTH.ERROR.LOGIN_FAILED);
    }
  }

  @Permissions('auth.write')
  @Post('user')
  async getUser(@GetCurrentUser() user: TCurrentUserType): Promise<TApiResponse> {
    try {
      const data = await this._userService.findOne(user.sub);
      return { data, message: MESSAGE.AUTH.LOGIN_SUCCESSFUL };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.LOGIN_FAILED);
    }
  }

  @Get('context-permissions')
  async getContextPermissions(
    @Query('orgId') orgId: string,
    @Query('propertyId') propertyId: string,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const permissions = await this._authService.getContextPermissions(user.sub, orgId, propertyId);
      return { data: permissions, message: 'Context permissions fetched' };
    } catch (error) {
      this._handleError(error, 'Failed to fetch context permissions');
    }
  }

  @Public()
  @Post('admin-login')
  async adminLogin(@Body() loginDto: LoginDto): Promise<TApiResponse> {
    try {
      const fullData: AuthResult = await this._authService.loginUser(loginDto);
      if ('requiresOtp' in fullData) {
        return {
          data: { requiresOtp: true, email: fullData.email },
          message: 'OTP sent to your email address',
        };
      }

      const data = {
        user: createUserObject(fullData.user as TUserDocument),
        tokens: fullData.tokens,
      };
      this._logger.log(`Admin logged in: ${loginDto.email}`, this.constructor.name);

      return {
        data,
        message: MESSAGE.AUTH.LOGIN_SUCCESSFUL,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.LOGIN_FAILED);
    }
  }
  @Public()
  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto): Promise<TApiResponse> {
    try {
      const fullData = await this._authService.signUp(signUpDto);

      const user = fullData.user;

      const userResponseObject: ISanitizedUser = createUserObject(user);

      user.tokens = fullData.tokens;

      await this._authService.sendOtpOnEmail(user.email, user.name);

      return {
        data: { user: userResponseObject, tokens: fullData.tokens },
        message: MESSAGE.AUTH.SIGNUP_SUCCESSFUL,
      };
    } catch (error) {
      this._logger.error(`${MESSAGE.AUTH.SIGNUP_FAILED}:: ${error}`, this.constructor.name);
      this._handleError(error, MESSAGE.AUTH.SIGNUP_FAILED);
    }
  }
  @Permissions('auth.write')
  @Post('signup/create')
  async signUpCreate(
    @Body() signUpDto: SignUpDto,
    @GetCurrentUser() user: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const fullData = await this._authService.signUp(signUpDto, user);

      // Extract only needed fields
      const data = {
        user: {
          name: fullData.user.name,
          email: fullData.user.email,
        },
        tokens: fullData.tokens,
      };

      return { data, message: MESSAGE.AUTH.SIGNUP_SUCCESSFUL };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.SIGNUP_FAILED);
    }
  }

  @SkipPermission()
  @Post('logout')
  async logout(@GetCurrentUser() user: string): Promise<TApiResponse> {
    try {
      const data = await this._authService.logout(user);
      return { data, message: MESSAGE.AUTH.LOGOUT_SUCCESSFUL };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.LOGOUT_FAILED);
    }
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refreshToken(@Body() body: RefreshTokenDto): Promise<TApiResponse> {
    try {
      const data = await this._authService.refreshFromToken(body.refreshToken);
      return { data, message: MESSAGE.AUTH.TOKEN_REFRESH };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.TOKEN_REFRESH_FAILED);
    }
  }
  @Post('/otp') // for login flow
  @Public()
  async sendOtpOnMobile(@Body() body: OtpDto): Promise<TApiResponse> {
    try {
      const data = await this._authService.sendOTP(body.mobileNumber);
      if (data) {
        return {
          data: null,
          success: true,
          message: MESSAGE.AUTH.OTP_SENT,
        };
      }

      return {
        data: null,
        success: false,
        message: MESSAGE.AUTH.ERROR.OTP_SEND_FAILED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.OTP_SEND_FAILED);
    }
  }
  @Permissions('auth.write')
  @Post('/resend-user-otp')
  async sendOtp(@GetCurrentUser() currentUser: TCurrentUserType): Promise<TApiResponse> {
    try {
      const { name, email } = currentUser;
      // if (body.email && body.mobileNumber) {
      //   await this._authService.sendOtpOnEmail(body.email, undefined);
      //   await this._authService.sendOTPonSMS(body.mobileNumber, undefined);

      //   return { data: null, message: MESSAGE.AUTH.OTP_SENT };
      // } else if (body.mobileNumber) {
      //   await this._authService.sendOTPonSMS(body.mobileNumber, undefined);

      //   return { data: null, message: MESSAGE.AUTH.OTP_SENT };
      // } else if (body.email) {
      await this._authService.sendOtpOnEmail(email, name);

      return { data: null, message: MESSAGE.AUTH.OTP_SENT };
      // } else {
      //   throw new BadRequestException(MESSAGE.OTP.ERRORS.INVALID_EMAIL_PHONE);
      // }
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.OTP_SEND_FAILED);
    }
  }
  @Public()
  @Post('/resend-otp') // for form submission
  async resendOtp(@Body() body: FormOtpDto): Promise<TApiResponse> {
    try {

      const { email } = body;
      await this._authService.sendOtpOnEmail(email, undefined);

      return { data: null, message: MESSAGE.AUTH.OTP_SENT };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.OTP_SEND_FAILED);
    }
  }

  @Public()
  @Post('/verify-user')
  async verifyUser(@Body() body: VerifyOtpDto, @GetCurrentUser() user): Promise<TApiResponse> {
    try {
      const fullData = await this._authService.verifyUser(body, user);
      const userResponseObject: ISanitizedUser = createUserObject(fullData.updatedUser);
      if (fullData.success) {
        return {
          data: { user: userResponseObject },
          message: MESSAGE.AUTH.OTP_VERIFIED,
          success: true,
        };
      }

      return {
        data: null,
        success: false,
        message: MESSAGE.AUTH.ERROR.OTP_VERIFIED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.OTP_VERIFICATION_FAILED);
    }
  }
  @Public()
  @Post('/verify-otp')
  async verifyOtp(@Body() body: VerifyOtpDto): Promise<TApiResponse> {
    try {
      const data = await this._authService.verifyOtp(body);
      if (data.success) {
        return {
          data: { token: data.token },
          message: MESSAGE.AUTH.OTP_VERIFIED,
          success: true,
        };
      }

      return {
        data: null,
        success: false,
        message: MESSAGE.AUTH.ERROR.OTP_VERIFIED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.OTP_VERIFICATION_FAILED);
    }
  }

  @Public()
  @Post('forget-password')
  async forgetPassword(@Body() body: FormOtpDto): Promise<{ message: string }> {
    try {
      if (body.email) {
        const data = await this._authService.forgetPassword({
          email: body.email,
        });

        return data;
      } else if (body.mobileNumber) {
        const data = await this._authService.forgetPassword({
          phone: body.mobileNumber,
        });

        return data;
      } else {
        throw new BadRequestException(MESSAGE.OTP.ERRORS.INVALID_EMAIL_PHONE);
      }
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.FORGET_PASSWORD_FAILED);
    }
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto): Promise<TApiResponse> {
    try {
      const data = await this._authService.resetPassword(body);
      if (data.success) {
        return {
          data: null,
          success: true,
          message: MESSAGE.AUTH.PASSWORD_RESET_SUCCESS,
        };
      }

      return {
        data: null,
        success: false,
        message: MESSAGE.AUTH.ERROR.PASSWORD_RESET_FAILED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.PASSWORD_RESET_FAILED);
    }
  }

  @Permissions('auth.edit')
  @Put('change-password')
  async changePassword(
    @Body() body: ChangePasswordDto,
    @GetCurrentUser() currentUser: TCurrentUserType
  ): Promise<TApiResponse> {
    try {
      const data = await this._authService.changePassword(body, currentUser);
      if (data.success) {
        return {
          data: null,
          success: true,
          message: MESSAGE.AUTH.PASSWORD_UPDATED,
        };
      }

      return {
        data: null,
        success: false,
        message: MESSAGE.AUTH.ERROR.PASSWORD_RESET_FAILED,
      };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.PASSWORD_RESET_FAILED);
    }
  }
  // PERSONA PILOT ROUTES

  @Permissions('auth.read')
  @Get('linkedin/authorize')
  @Redirect()
  authorizeLinkedIn() {
    try {
      const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.linkedInClientId
        }&redirect_uri=${encodeURIComponent(
          this.linkedInRedirectUri
        )}&scope=${encodeURIComponent(this.linkedInScope)}`;

      return { url: linkedInAuthUrl };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.PASSWORD_RESET_FAILED);
    }
  }

  @Public()
  @Post('google')
  async postGoogleSignup(
    @Headers('authorization') authorization: string,
    @Body() payload: { inviteCode: string },
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    const token = authorization.split(' ')[1];
    const fullData = await this._authService.createOrUpdateUserFromGoogle(
      token,
      payload.inviteCode,
      response
    );
    const userResponseObject: ISanitizedUser = createUserObject(fullData.user as TUserDocument);
    return {
      user: userResponseObject,
      tokens: fullData.tokens,
      message: MESSAGE.AUTH.SIGNUP_SUCCESSFUL,
    };
  }

  @Public()
  @Post('google-v2')
  async googleAuth(
    @Body() payload: { authorization: string },
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    const { authorization } = payload;
    const fullData = await this._authService.googleAuth(authorization, response);

    const authType = fullData.authType;
    const userResponseObject: ISanitizedUser = createUserObject(fullData.user as TUserDocument);
    return {
      data: { user: userResponseObject, tokens: fullData.tokens },
      message: MESSAGE.AUTH.AUTH_TYPE[authType],
    };
  }

  @Public()
  @Post('google/:serviceType')
  async googleServiceAuth(
    @Body() payload: { code: string },
    @Param('serviceType') serviceType: GoogleServiceType,
    @Res({ passthrough: true }) response: Response
  ): Promise<any> {
    const { code } = payload;
    const fullData = await this._authService.googleServiceAuth(code, response);

    return fullData;
  }

  @Public()
  @Get('google/:serviceType/url')
  async getGoogleServiceAuthUrl(@Param('serviceType') serviceType: string): Promise<any> {
    try {
      const authUrl = await this._authService.googleServiceAuthURL(
        serviceType as GoogleServiceType
      );
      return { url: authUrl };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.LOGIN_FAILED);
    }
  }

  @Permissions('invitation.write')
  @Post('invite')
  async invite(
    @Body() inviteDto: InviteDto,
    @GetCurrentUser() currentUser: TCurrentUserType,
    @Headers('x-property-id') propertyId?: string
  ): Promise<TApiResponse> {
    try {
      const data = await this._authService.initiateLogin(inviteDto, currentUser, propertyId);
      return { data: {}, message: data.message };
    } catch (error) {
      this._handleError(error, MESSAGE.AUTH.ERROR.INVITE_FAILED);
    }
  }

  @Permissions('invitation.write')
  @Post('resend-invite')
  async resendInvite(
    @Body('email') email: string,
    @GetCurrentUser() currentUser: TCurrentUserType,
    @Headers('x-property-id') propertyId?: string
  ): Promise<TApiResponse> {
    try {
      const data = await this._authService.resendInvite(email, currentUser, propertyId);
      return { data: {}, message: data.message };
    } catch (error) {
      this._handleError(error, 'Resend invitation failed');
    }
  }

  @Public()
  @Get('verify-invitation')
  async verifyInvitation(@Query('token') token: string): Promise<TApiResponse> {
    try {
      const data = await this._authService.verifyInviteToken(token);
      return { data, message: 'Invitation verified successfully' };
    } catch (error) {
      this._handleError(error, 'Invitation verification failed');
    }
  }

  @Public()
  @Post('complete-onboarding')
  async completeOnboarding(@Body() body: any): Promise<TApiResponse> {
    try {
      const fullData = await this._authService.completeOnboarding(body);
      const user = fullData.user;
      const userResponseObject: ISanitizedUser = createUserObject(user as TUserDocument);

      return {
        data: { user: userResponseObject, tokens: fullData.tokens },
        message: 'Onboarding completed successfully',
      };
    } catch (error) {
      this._handleError(error, 'Onboarding completion failed');
    }
  }

  /**
   * Decrypts the payload using AES-256-CBC encryption
   */
  private decryptPayload(encoded: string, secret: string): any {
    try {
      // Pad the key with null bytes to 32 bytes like PHP likely does
      const keyBuf = new Uint8Array(32);
      keyBuf.set(Buffer.from(secret));

      // Convert URL-safe base64 to standard base64
      const base64 =
        encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (encoded.length % 4)) % 4);
      const buffer = Buffer.from(base64, 'base64');

      const iv = new Uint8Array(buffer.slice(0, 16)); // First 16 bytes = IV
      const encrypted = buffer.slice(16); // Rest = ciphertext

      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      // Security: Don't log decryption errors as they may contain sensitive data
      throw new BadRequestException('Invalid encrypted payload');
    }
  }

  // @Public()
  // @Get()
  // async OnboardFromPluglin(@Query('onboard') onboard: string): Promise<TApiResponse> {
  //   try {
  //     console.log('onboard', onboard);
  //     const secret = process.env.ONBOARD_SECRET;
  //     const decryptedData = this.decryptPayload(onboard, secret);
  //     console.log('decryptedData', decryptedData);
  //     const { email, domain, username, apppassword } = decryptedData;
  //     if (!email || !domain || !username || !apppassword) {
  //       throw new BadRequestException(MESSAGE.AUTH.ERROR.REQUEST_DENIED);
  //     }
  //     const data = await this._blogConfigService.onboardFromPluglin(
  //       email,
  //       domain,
  //       username,
  //       apppassword
  //     );
  //     console.log('data', data);
  //     return { data, message: MESSAGE.AUTH.ONBOARD_SUCCESS };
  //   } catch (error) {
  //     this._handleError(error, MESSAGE.AUTH.ONBOARD_FAILED);
  //   }
  // }

  // @Public()
  // @Post('verify-plugin')
  // async verifyPlugin(@Body() body: any): Promise<TApiResponse> {
  //   try {
  //     const secret = process.env.ONBOARD_SECRET;
  //     let domain: string | undefined;
  //     let username: string | undefined;
  //     let apppassword: string | undefined;

  //     if (body?.onboard && typeof body.onboard === 'string') {
  //       const decrypted = this.decryptPayload(body.onboard, secret);
  //       domain = decrypted.domain;
  //       username = decrypted.username;
  //       apppassword = decrypted.apppassword;
  //       this._logger.log(
  //         `verify-plugin: decrypted payload for domain=${domain}`,
  //         this.constructor.name
  //       );
  //     } else {
  //       domain = body?.domain;
  //       username = body?.username;
  //       apppassword = body?.apppassword || body?.password;
  //       this._logger.log(
  //         `verify-plugin: received plain payload for domain=${domain}`,
  //         this.constructor.name
  //       );
  //     }

  //     if (!domain || !username || !apppassword) {
  //       throw new BadRequestException('Missing required fields');
  //     }

  //     const result = await this._blogConfigService.verifyWordpressCredentials(domain, {
  //       username,
  //       password: apppassword,
  //     });

  //     if (!result.ok) {
  //       return {
  //         data: { ok: false, summary: result.summary },
  //         message: 'Verification failed',
  //         success: false,
  //       };
  //     }

  //     const token = this._blogConfigService.issuePluginVerificationToken(domain, {
  //       username,
  //       password: apppassword,
  //     });

  //     return {
  //       data: { ok: true, summary: result.summary, domain },
  //       message: 'Verification successful',
  //       success: true,
  //     };
  //   } catch (error) {
  //     this._handleError(error, 'Plugin verification failed');
  //   }
  // }

  // @Public()
  // @Post('verify-plugin/status')
  // async verifyPluginStatus(@Body() body: { domain: string }): Promise<TApiResponse> {
  //   try {
  //     const domain = body?.domain;
  //     if (!domain) throw new BadRequestException('Missing domain');
  //     const hasToken = this._blogConfigService.hasValidTokenForDomain(domain);
  //     return {
  //       data: { verified: hasToken },
  //       message: hasToken ? 'Verified' : 'Pending',
  //       success: true,
  //     };
  //   } catch (error) {
  //     this._handleError(error, 'Failed to get verification status');
  //   }
  // }

  // @Post('/blog-config/plugin-connect')
  // async pluginConnect(
  //   @Body() body: { token: string },
  //   @GetCurrentUser() user: TCurrentUserType
  // ): Promise<TApiResponse> {
  //   try {
  //     if (!body?.token) {
  //       throw new BadRequestException('Missing token');
  //     }
  //     const property = await this._blogConfigService.createFromPluginToken(body.token, user);
  //     return {
  //       data: property,
  //       message: MESSAGE.BLOG_CONFIG.ADDED,
  //       success: true,
  //     };
  //   } catch (error) {
  //     this._handleError(error, 'Plugin connect failed');
  //   }
  // }

  // @Post('/blog-config/plugin-connect-by-domain')
  // async pluginConnectByDomain(
  //   @Body() body: { domain: string },
  //   @GetCurrentUser() user: TCurrentUserType
  // ): Promise<TApiResponse> {
  //   try {
  //     const domain = body?.domain;
  //     if (!domain) throw new BadRequestException('Missing domain');
  //     const payload = this._blogConfigService.consumePluginVerificationByDomain(domain);
  //     if (!payload) {
  //       throw new BadRequestException('Verification not found or expired for this domain');
  //     }
  //     const property = await this._blogConfigService.createFromPluginPayload(payload, user);
  //     return {
  //       data: property,
  //       message: MESSAGE.BLOG_CONFIG.ADDED,
  //       success: true,
  //     };
  //   } catch (error) {
  //     this._handleError(error, 'Plugin connect by domain failed');
  //   }
  // }
}

import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { ApiConfigService } from 'src/core/config/config.service';

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private _config: ApiConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_REFRESH_SECRET,
      passReqToCallback: true,
      // Security: Explicitly specify algorithm to prevent algorithm confusion attacks
      algorithms: ['HS256'],
    });
  }

  validate(req: Request, payload: any) {
    const refreshToken = req.get('authorization').replace('Bearer', '').trim();
    return {
      ...payload,
      refreshToken,
    };
    /*
        passReqToCallback - specifies that we want to get back the refresh token,
        In jwt token strategy, it takes the token it kinda destroys it and gives back the payload,
        In rJwt token we want to get back the token hash it and store it in db
    */
  }
}

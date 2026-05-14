import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { JwtPayload } from '../interface/auth.interface';
import { ApiConfigService } from 'src/core/config/config.service';

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
      // Security: Explicitly specify algorithm to prevent algorithm confusion attacks
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
    /*
        since nestjs is using epxpres under the hood, it is going to do
        req.user = payload;
        It is going to attach the user object to the request object,
        the validate function just works like that
    */
  }
}

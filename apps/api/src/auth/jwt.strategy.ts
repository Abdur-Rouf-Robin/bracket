import { Injectable } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { ConfigService } from '@nestjs/config';



export type JwtPayload = { sub: string; email: string; name?: string };



@Injectable()

export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(config: ConfigService) {

    super({

      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret',

    });

  }



  validate(payload: JwtPayload) {

    return {

      id: payload.sub,

      email: payload.email,

      name: payload.name ?? '',

    };

  }

}



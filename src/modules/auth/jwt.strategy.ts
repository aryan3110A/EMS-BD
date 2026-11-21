import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { resolveJwtSecret } from '../../common/config/jwt-secret';

/**
 * EventSource cannot send an Authorization header, so the notifications SSE stream
 * passes the token as ?token=. Accept that form ONLY on the SSE route so tokens are
 * not encouraged in URLs (and therefore logs/history) anywhere else.
 */
function sseQueryToken(req: { path?: string; query?: Record<string, unknown> }): string | null {
  const token = req?.query?.token;
  if (typeof token !== 'string' || !token) return null;
  return req.path?.endsWith('/notifications/sse') ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        sseQueryToken,
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService),
    });
  }

  async validate(payload: { sub: string; email: string }): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { office: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      officeId: user.officeId ?? undefined,
      name: user.name,
    };
  }
}

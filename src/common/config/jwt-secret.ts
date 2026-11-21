import { ConfigService } from '@nestjs/config';

const DEV_FALLBACK_SECRET = 'ems-dev-secret';
const MIN_PRODUCTION_LENGTH = 32;

/**
 * Resolve the JWT signing secret.
 *
 * In development a fixed fallback keeps local setup friction-free. In production the
 * app refuses to start without a strong secret, because a guessable secret lets anyone
 * mint a token for any user (including SUPER_ADMIN).
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (process.env.NODE_ENV !== 'production') {
    return secret || DEV_FALLBACK_SECRET;
  }
  if (!secret || secret === DEV_FALLBACK_SECRET || secret.length < MIN_PRODUCTION_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set to a random string of at least ${MIN_PRODUCTION_LENGTH} characters in production`,
    );
  }
  return secret;
}

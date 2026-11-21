"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveJwtSecret = resolveJwtSecret;
const DEV_FALLBACK_SECRET = 'ems-dev-secret';
const MIN_PRODUCTION_LENGTH = 32;
function resolveJwtSecret(config) {
    const secret = config.get('JWT_SECRET')?.trim();
    if (process.env.NODE_ENV !== 'production') {
        return secret || DEV_FALLBACK_SECRET;
    }
    if (!secret || secret === DEV_FALLBACK_SECRET || secret.length < MIN_PRODUCTION_LENGTH) {
        throw new Error(`JWT_SECRET must be set to a random string of at least ${MIN_PRODUCTION_LENGTH} characters in production`);
    }
    return secret;
}
//# sourceMappingURL=jwt-secret.js.map
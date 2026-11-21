import { ConfigService } from '@nestjs/config';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { resolveJwtSecret } from './config/jwt-secret';
import { RolesGuard } from './guards/roles.guard';
import { NotificationService } from './services/notification.service';
import { UserRole } from './constants/enums';

function configWith(secret?: string) {
  return { get: () => secret } as unknown as ConfigService;
}

describe('resolveJwtSecret', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('falls back to a dev secret outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(resolveJwtSecret(configWith(undefined))).toBe('ems-dev-secret');
  });

  it('refuses to start in production without a secret', () => {
    process.env.NODE_ENV = 'production';
    expect(() => resolveJwtSecret(configWith(undefined))).toThrow(/JWT_SECRET/);
  });

  it('refuses the dev fallback or a short secret in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => resolveJwtSecret(configWith('ems-dev-secret'))).toThrow();
    expect(() => resolveJwtSecret(configWith('short-secret'))).toThrow();
  });

  it('accepts a strong secret in production', () => {
    process.env.NODE_ENV = 'production';
    const strong = 'x'.repeat(48);
    expect(resolveJwtSecret(configWith(strong))).toBe(strong);
  });
});

describe('RolesGuard', () => {
  function contextFor(role: string | undefined, required: string[] | undefined) {
    const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
    const ctx = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    } as unknown as ExecutionContext;
    return { guard: new RolesGuard(reflector), ctx };
  }

  it('allows any authenticated user when no roles are required', () => {
    const { guard, ctx } = contextFor(UserRole.INVENTORY_TEAM, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks a role that is not listed', () => {
    const { guard, ctx } = contextFor(UserRole.INVENTORY_TEAM, [UserRole.CONTRACT_TEAM]);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('allows a listed role', () => {
    const { guard, ctx } = contextFor(UserRole.CONTRACT_TEAM, [UserRole.CONTRACT_TEAM]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('always allows SUPER_ADMIN', () => {
    const { guard, ctx } = contextFor(UserRole.SUPER_ADMIN, [UserRole.CONTRACT_TEAM]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks requests without a user', () => {
    const { guard, ctx } = contextFor(undefined, [UserRole.CONTRACT_TEAM]);
    expect(guard.canActivate(ctx)).toBe(false);
  });
});

describe('NotificationService.markRead', () => {
  it('scopes the update to the caller and their role', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new NotificationService({ notification: { updateMany } } as never);
    await expect(service.markRead('n1', 'u1', UserRole.CONTRACT_TEAM)).resolves.toEqual({ id: 'n1' });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1', OR: [{ userId: 'u1' }, { targetRole: UserRole.CONTRACT_TEAM }] },
      }),
    );
  });

  it("rejects marking someone else's notification", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new NotificationService({ notification: { updateMany } } as never);
    await expect(service.markRead('n2', 'u1', UserRole.CONTRACT_TEAM)).rejects.toBeInstanceOf(NotFoundException);
  });
});

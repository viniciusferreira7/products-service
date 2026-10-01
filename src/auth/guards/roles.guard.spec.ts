import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../authenticated-user';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { RolesGuard } from './roles.guard';

class Routes {
  @Roles(UserRole.SELLER)
  sellersOnly() {
    // route body is irrelevant here
  }

  anyone() {
    // route body is irrelevant here
  }
}

@Roles(UserRole.SELLER)
class SellerController {
  anyRoute() {
    // route body is irrelevant here
  }
}

function contextFor(
  controller: new () => object,
  handler: (...args: never[]) => unknown,
  user?: Partial<AuthenticatedUser>
) {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const seller = { id: 'user-1', role: UserRole.SELLER };
const buyer = { id: 'user-2', role: UserRole.BUYER };

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('lets any user through a route without @Roles()', () => {
    expect(
      guard.canActivate(contextFor(Routes, Routes.prototype.anyone, buyer))
    ).toBe(true);
  });

  it('lets a user whose role is allowed through', () => {
    expect(
      guard.canActivate(
        contextFor(Routes, Routes.prototype.sellersOnly, seller)
      )
    ).toBe(true);
  });

  it('answers 403 to a user whose role is not allowed', () => {
    expect(() =>
      guard.canActivate(contextFor(Routes, Routes.prototype.sellersOnly, buyer))
    ).toThrow(ForbiddenException);
  });

  it('applies @Roles() set on the controller', () => {
    expect(() =>
      guard.canActivate(
        contextFor(SellerController, SellerController.prototype.anyRoute, buyer)
      )
    ).toThrow(ForbiddenException);
  });

  it('answers 403 when there is no user (a @Public() route with @Roles())', () => {
    expect(() =>
      guard.canActivate(contextFor(Routes, Routes.prototype.sellersOnly))
    ).toThrow(ForbiddenException);
  });
});

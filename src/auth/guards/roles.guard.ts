import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../authenticated-user';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { UserRole } from '../enums/user-role.enum';

/**
 * Registered globally after `JwtAuthGuard`, so `req.user` is already set.
 * Guards run before pipes: a user without the role gets 403 whatever the body.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!roles) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}

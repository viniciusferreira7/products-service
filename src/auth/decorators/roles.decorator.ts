import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../enums/user-role.enum';

/** Read by `RolesGuard`; shared so the key is spelled in one place. */
export const ROLES_KEY = 'roles';

/** Restricts a route, or a whole controller, to users with one of `roles`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

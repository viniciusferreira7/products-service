import 'reflect-metadata';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY, Roles } from './roles.decorator';

class Routes {
  @Roles(UserRole.SELLER)
  sellersOnly() {
    // route body is irrelevant here
  }

  anyone() {
    // route body is irrelevant here
  }
}

@Roles(UserRole.BUYER, UserRole.SELLER)
class EveryoneController {}

describe('@Roles()', () => {
  it('uses the roles metadata key', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('records the roles a route handler allows', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, Routes.prototype.sellersOnly)
    ).toEqual([UserRole.SELLER]);
    expect(
      Reflect.getMetadata(ROLES_KEY, Routes.prototype.anyone)
    ).toBeUndefined();
  });

  it('records the roles a whole controller allows', () => {
    expect(Reflect.getMetadata(ROLES_KEY, EveryoneController)).toEqual([
      UserRole.BUYER,
      UserRole.SELLER,
    ]);
  });
});

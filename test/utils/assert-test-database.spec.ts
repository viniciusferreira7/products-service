import { assertTestDatabase } from './assert-test-database';

describe('assertTestDatabase', () => {
  it('accepts a database whose name ends in _test', () => {
    expect(() => assertTestDatabase('products_db_test')).not.toThrow();
  });

  it('refuses the dev database', () => {
    expect(() => assertTestDatabase('products_db')).toThrow(/products_db/);
  });

  it('refuses a missing database name', () => {
    expect(() => assertTestDatabase(undefined)).toThrow();
  });
});

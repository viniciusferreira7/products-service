/**
 * A valid `POST /products` body. Overrides set to `undefined` drop the
 * property, so a spec can send a body with a field missing.
 */
export function makeCreateProductBody(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: 'Mechanical keyboard',
    description: 'Hot-swappable, 75% layout',
    price: 349.9,
    stock: 10,
    ...overrides,
  };

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) {
      delete body[key];
    }
  }

  return body;
}

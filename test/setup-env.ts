/**
 * Environment defaults for the lanes that boot the Nest application
 * (integration and e2e). `.env` is gitignored, so without this a fresh clone
 * or a CI run would fail the Zod validation in `src/env/env.ts`.
 *
 * These are throwaway values — never put real credentials here. Anything
 * already present in `process.env` wins, so CI can override any of them.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  // Port 5438 is what `docker-compose.yaml` publishes for the test Postgres
  // (`${DB_TEST_PORT:-5438}`) — the dev one owns 5437.
  DB_HOST: 'localhost',
  DB_PORT: '5438',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_DATABASE: 'products_db_test',
  // `NODE_ENV=test` disables the signals SDK, so nothing is exported. These
  // only exist to satisfy the Zod schema.
  OTEL_SERVICE_NAME: 'products-service',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}

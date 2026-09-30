# products-service

Products microservice for the Marketplace microservices architecture. Owns the
product catalog, backed by PostgreSQL 15 via TypeORM.

This first version lays the foundation: the `Product` entity, the database
connection, JWT authentication, health probes and API docs. Catalog endpoints land in a later step.

## Where it sits

```
                      ┌──▶ users-service      ── users_db
api-gateway (3333) ───┼──▶ products-service (3001) ── products_db (5437)
                      └──▶ checkout-service ──[payments exchange]──▶ payments-service
```

## Data model

`products` table:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | generated |
| `name` | varchar(255) | |
| `description` | text | |
| `price` | decimal(10,2) | read back as a number; must be >= 0 |
| `stock` | int | defaults to 0; must be >= 0 |
| `sellerId` | uuid | `seller_id`; user id from the users service, no foreign key |
| `isActive` | boolean | `is_active`; defaults to true |
| `createdAt` / `updatedAt` | timestamptz | set automatically |

## Requirements

- Node 24+
- pnpm 11+
- Docker (PostgreSQL)

## Setup

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm start:dev
```

The service listens on `http://localhost:3001`; Swagger UI is at
`http://localhost:3001/api`. In `dev` TypeORM synchronizes the schema, so the
`products` table is created on first boot.

The test lanes get their own throwaway Postgres behind the `test` profile, on
port 5438 with the `products_db_test` database, so the suite never writes to
the dev database. `pnpm test:int` and `pnpm test:e2e` bring it up themselves
through `pnpm test:infra`; `pnpm test:infra:down` stops it again.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm start:dev` | Watch mode with the observability preload |
| `pnpm start:prod` | Runs the compiled `dist/src/main` |
| `pnpm build` | Compile to `dist/` |
| `pnpm check` / `pnpm check:fix` | Biome lint + format |
| `pnpm check:type` | `tsc --noEmit` |
| `pnpm test:infra` | Boots the test Postgres and waits for it to be healthy |
| `pnpm test:infra:down` | Stops the test infrastructure |
| `pnpm test:unit` | Unit lane — `*.spec.ts`, no infra |
| `pnpm test:int` | Integration lane — `*.int-spec.ts`, real test Postgres |
| `pnpm test:e2e` | E2E lane — `*.e2e-spec.ts`, full HTTP boot against the test Postgres |
| `pnpm test:cov` | Unit lane with coverage |

## Layout

```
src/
  app.module.ts            Root module: config + env + observability + TypeORM + products + auth + health
  app.setup.ts             CORS + global ValidationPipe, shared by main.ts and the e2e harness
  auth/                    JWT strategy, global guard and @Public (tokens are signed by users-service)
  config/                  TypeORM options and Swagger document
  env/                     Zod schema, EnvModule and typed EnvService
  health/                  /health, liveness/readiness/startup probes and graceful shutdown
  products/                Product entity, decimal transformer and ProductsModule
  utils/                   Service metadata
test/
  setup-env.ts             Env defaults for the int/e2e lanes
  factories/               DI container, HTTP app, test-only routes and tokens
  config/                  OpenAPI document helpers
  utils/                   Test-database guard and SQLSTATE helper
```

## Environment

Every variable is validated by `src/env/env.ts` at boot — an invalid or missing
value fails the process instead of surfacing later. See `.env.example` for the
full list.

`JWT_SECRET` verifies the tokens users-service signs on `POST /auth/login`. It
must be the same value configured in users-service and the api-gateway, and at
least 32 characters long.

## Authentication

Every route requires `Authorization: Bearer <token>` (HS256, issued by
users-service) unless it is marked `@Public()`. A valid token exposes
`req.user = { id, email, role }`; any failure answers a generic `401`.
`GET /` and `/health/*` are public.

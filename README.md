# products-service

Products microservice for the Marketplace microservices architecture. Owns the
product catalog, backed by PostgreSQL 15 via TypeORM.

It has the `Product` entity, the database connection, JWT authentication,
health probes, API docs and the first catalog endpoint, `POST /products`.

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
  auth/                    JWT strategy, global JWT and roles guards, @Public and @Roles (tokens are signed by users-service)
  config/                  TypeORM options and Swagger document
  env/                     Zod schema, EnvModule and typed EnvService
  health/                  /health, liveness/readiness/startup probes and graceful shutdown
  products/                Product entity, DTOs, ProductsService, ProductsController and ProductsModule
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

A route marked `@Roles(...)` also requires one of those roles; any other user
gets `403`. The roles guard runs after the JWT guard and before validation, so
a user without the role gets `403` whatever the body.

## Endpoints

### `POST /products` (sellers only)

Creates a product owned by the seller in the token (`sellerId = req.user.id`),
always with `isActive: true`.

| Field | Rules |
| --- | --- |
| `name` | required string, not blank, at most 255 characters, no control characters or line breaks |
| `description` | required string, not blank, line breaks allowed, no other control characters |
| `price` | required number, at most 2 decimal places, from `0.01` to `99999999.99` |
| `stock` | required integer, `>= 0` |

`sellerId`, `isActive` and any other property in the body are rejected.

| Status | When |
| --- | --- |
| `201` | Created; answers the product |
| `400` | The body failed validation; `message` lists every problem |
| `401` | Missing or invalid token |
| `403` | The user is not a seller |

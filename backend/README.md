# Backend

Fastify + Prisma + SQLite API.

## Project Setup

Migrations must be run before starting the backend. Without them, the database schema will be missing tables and the server may fail at runtime.

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run migrations**
   ```bash
   npx prisma migrate dev
   ```
   This applies all pending migrations and ensures the database schema (including the `Booking` table and others) exists.

3. **Start the server**
   ```bash
   npm run dev
   ```

Optional: seed the database with default users (admin, client):
```bash
npx prisma db seed
```

## Health

- `GET /health` — full health check (version, uptime, database).
- `GET /health/database` — database only; returns `{ database: "ok" }` when Prisma can run `SELECT 1`.

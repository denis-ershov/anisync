# Migration Guide: SQLite to PostgreSQL

## Overview

This project has been migrated from **SQLite** (better-sqlite3) to **PostgreSQL** using **Drizzle ORM** and **postgres.js**.

## What Changed

### Database Technology
- ❌ **Before**: SQLite with better-sqlite3 (synchronous)
- ✅ **After**: PostgreSQL with postgres.js (asynchronous, connection pooling)

### ORM/Query Builder
- ❌ **Before**: Raw SQL with prepared statements
- ✅ **After**: Drizzle ORM (type-safe queries)

### Key Benefits
- ⚡ **Performance**: Async operations with connection pooling
- 🔒 **Type Safety**: Full TypeScript inference
- 🚀 **Scalability**: PostgreSQL can handle concurrent users
- 🔄 **Migrations**: Automatic schema versioning
- 🛠 **Developer Experience**: Drizzle Studio for database GUI

## Setup Instructions

### 1. Install PostgreSQL

**Windows:**
```bash
# Download from https://www.postgresql.org/download/windows/
# Or use Docker:
docker run --name anisync-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux:**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE anisync;

# Create user (optional)
CREATE USER anisync_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE anisync TO anisync_user;
```

### 3. Configure Environment

Copy `.env.example` to `.env` and update:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anisync
# Or with custom user:
# DATABASE_URL=postgresql://anisync_user:your_password@localhost:5432/anisync

JWT_SECRET=your-secret-key-here
```

### 4. Run Migrations

```bash
# Generate migration files (if schema changed)
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Or use push for development (skips migration files)
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

## Database Scripts

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate migration files from schema |
| `npm run db:migrate` | Apply migrations to database |
| `npm run db:push` | Push schema changes without migration files |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

## Migration from Existing SQLite Data

If you have existing SQLite data to migrate:

### Option 1: Manual Export/Import

```bash
# Export from SQLite
sqlite3 database.sqlite .dump > data.sql

# Convert to PostgreSQL format (may need manual adjustments)
# Then import:
psql -U postgres -d anisync < data.sql
```

### Option 2: Use pgloader

```bash
# Install pgloader
sudo apt install pgloader  # Linux
brew install pgloader      # macOS

# Create conversion config
pgloader sqlite://database.sqlite postgresql://postgres:postgres@localhost/anisync
```

## Code Changes

### Service Layer Changes

All service methods are now **async**. Update your code:

```typescript
// ❌ Before (SQLite - synchronous)
const user = UserService.getUserById(1);

// ✅ After (PostgreSQL - asynchronous)
const user = await UserService.getUserById(1);
```

### API Route Changes

All database operations now require `await`:

```typescript
// ❌ Before
export async function GET(request: Request) {
  const users = UserService.getAllUsers(); // sync
  return Response.json(users);
}

// ✅ After
export async function GET(request: Request) {
  const users = await UserService.getAllUsers(); // async
  return Response.json(users);
}
```

## Schema Changes

### Column Naming Convention

Drizzle uses **camelCase** in TypeScript but **snake_case** in database:

```typescript
// TypeScript (camelCase)
user.passwordHash
user.createdAt

// Database (snake_case)
password_hash
created_at
```

### Type Mapping

| SQLite | PostgreSQL | TypeScript |
|--------|------------|------------|
| INTEGER | serial | number |
| TEXT | text | string |
| DATETIME | timestamp | Date |
| BOOLEAN | boolean | boolean |

## Troubleshooting

### Connection Issues

```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Check connection string
echo $DATABASE_URL
```

### Migration Errors

```bash
# Reset database (development only!)
psql -U postgres -c "DROP DATABASE anisync;"
psql -U postgres -c "CREATE DATABASE anisync;"
npm run db:migrate
```

### Type Errors

If you get type errors, regenerate types:

```bash
npm run db:generate
```

## Production Deployment

### Environment Variables

Ensure `DATABASE_URL` is set in production:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

### SSL Configuration

For production databases (e.g., Vercel Postgres, Supabase):

```typescript
// src/lib/db/index.ts
const client = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
  max: 10,
});
```

### Connection Pooling

The default configuration uses 10 connections. Adjust based on your needs:

```typescript
const client = postgres(connectionString, {
  max: 20, // Maximum connections
  idle_timeout: 20,
  connect_timeout: 10,
});
```

## Rollback (if needed)

To rollback to SQLite:

1. Reinstall dependencies:
   ```bash
   npm install better-sqlite3 @types/better-sqlite3
   npm uninstall drizzle-orm postgres drizzle-kit
   ```

2. Restore old files from git:
   ```bash
   git checkout HEAD~1 -- src/lib/database.ts src/lib/services/
   ```

## Support

For issues or questions:
- Drizzle ORM Docs: https://orm.drizzle.team/docs/overview
- postgres.js Docs: https://github.com/porsager/postgres
- PostgreSQL Docs: https://www.postgresql.org/docs/

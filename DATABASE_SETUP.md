# PostgreSQL Database Setup Guide

## Quick Start

### 1. Install PostgreSQL

**Windows:**
```bash
# Download installer from https://www.postgresql.org/download/windows/
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
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE anisync;

# Exit
\q
```

### 3. Configure Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anisync
JWT_SECRET=your-secret-key-here
```

### 4. Run Migrations

```bash
npm run db:migrate
```

### 5. Start Application

```bash
npm run dev
```

Application will be available at `http://localhost:9002`

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate migration files from schema |
| `npm run db:migrate` | Apply migrations to database |
| `npm run db:push` | Push schema changes (development) |
| `npm run db:studio` | Open Drizzle Studio (GUI) |

## Drizzle Studio

Browse and edit your database with a GUI:

```bash
npm run db:studio
```

Opens at `https://local.drizzle.studio`

## Troubleshooting

### Connection refused

```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Start PostgreSQL
# Windows (Services app)
# macOS: brew services start postgresql@16
# Linux: sudo systemctl start postgresql
```

### Password authentication failed

Update your connection string in `.env`:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/anisync
```

### Database does not exist

```bash
psql -U postgres -c "CREATE DATABASE anisync;"
```

## Production Setup

For production, use a managed PostgreSQL service:
- **Vercel Postgres**
- **Supabase**
- **Railway**
- **Neon**
- **DigitalOcean**

Update `.env`:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

Run migrations:
```bash
npm run db:migrate
```

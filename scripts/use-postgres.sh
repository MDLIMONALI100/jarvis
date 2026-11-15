#!/usr/bin/env bash
# Switch the Prisma datasource from SQLite to PostgreSQL (one-way, idempotent).
set -euo pipefail
cd "$(dirname "$0")/.."
sed -i.bak 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma && rm -f prisma/schema.prisma.bak
echo "Datasource provider set to postgresql."
echo "Now set DATABASE_URL=postgresql://... and run: npx prisma db push && npm run db:seed"

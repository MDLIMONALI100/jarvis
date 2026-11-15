#!/usr/bin/env bash
# Optional: switch to an offline SQLite file for local development.
# Do not commit the result: production (Vercel + Supabase) needs PostgreSQL.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import re
p = "prisma/schema.prisma"
s = open(p).read()
s = s.replace('provider  = "postgresql"', 'provider  = "sqlite"')
s = re.sub(r'\n\s*directUrl\s*=.*', '', s)
open(p, "w").write(s)
PY
echo 'Provider set to sqlite. Set DATABASE_URL="file:./dev.db" in .env, then: npm run setup'

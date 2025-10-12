#!/bin/bash

# Neon to Railway PostgreSQL Migration using pg_dump
set -e

echo "================================================================================"
echo "Data Migration: Neon → Railway PostgreSQL (using pg_dump)"
echo "================================================================================"
echo ""

# Neon credentials
NEON_URL="postgresql://neondb_owner:npg_5M7yFONVDqbr@ep-proud-shape-ad77yx9i-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Get Railway URL from environment
RAILWAY_URL="${DATABASE_URL}"

if [ -z "$RAILWAY_URL" ]; then
    echo "❌ DATABASE_URL not set in environment"
    exit 1
fi

echo "Source: Neon PostgreSQL"
echo "Target: Railway PostgreSQL"
echo ""
echo "This will:"
echo "  1. Dump data from Neon (excluding schema)"
echo "  2. Restore to Railway PostgreSQL"
echo ""
read -p "Proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🔄 Dumping data from Neon..."

# Dump only data (not schema since we already have it via Alembic)
pg_dump "$NEON_URL" \
    --data-only \
    --no-owner \
    --no-privileges \
    --disable-triggers \
    --file=neon_data.sql

if [ $? -eq 0 ]; then
    echo "✅ Dump completed: neon_data.sql"
else
    echo "❌ Dump failed"
    exit 1
fi

echo ""
echo "🔄 Restoring to Railway PostgreSQL..."

# Restore to Railway
psql "$RAILWAY_URL" < neon_data.sql

if [ $? -eq 0 ]; then
    echo "✅ Restore completed"
    echo ""
    echo "🧹 Cleaning up..."
    rm neon_data.sql
    echo "✅ Removed temporary dump file"
else
    echo "❌ Restore failed (dump file saved as neon_data.sql)"
    exit 1
fi

echo ""
echo "================================================================================"
echo "✅ Migration complete!"
echo "================================================================================"

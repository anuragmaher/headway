"""
Migrate data from Neon to Railway PostgreSQL
"""
import os
import json
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Railway URL from current environment
railway_url = os.getenv('DATABASE_URL')

# You'll need to provide the Neon URL
print("=" * 80)
print("Data Migration: Neon → Railway PostgreSQL")
print("=" * 80)
print()
print("Please provide your Neon PostgreSQL connection URL:")
print("(Format: postgresql://user:password@host/database)")
print()
neon_url = input("Neon URL: ").strip()

if not neon_url:
    print("❌ No Neon URL provided. Exiting.")
    exit(1)

print()
print(f"Source (Neon): {neon_url.split('@')[1] if '@' in neon_url else 'invalid'}")
print(f"Target (Railway): {railway_url.split('@')[1] if '@' in railway_url else 'invalid'}")
print()

confirm = input("Proceed with migration? (yes/no): ").strip().lower()
if confirm != 'yes':
    print("❌ Migration cancelled.")
    exit(0)

print()
print("🔄 Starting migration...")
print()

try:
    # Connect to both databases
    neon_engine = create_engine(neon_url)
    railway_engine = create_engine(railway_url)

    # Get list of tables to migrate (in dependency order)
    tables = [
        'users',
        'workspaces',
        'integrations',
        'themes',
        'messages',
        'features',
        'feature_messages',
        'workspace_data_points',
        'data_extraction_fields',
    ]

    total_rows = 0

    with neon_engine.connect() as neon_conn:
        with railway_engine.connect() as railway_conn:
            for table in tables:
                # Check if table exists in source
                result = neon_conn.execute(text(
                    f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')"
                ))
                table_exists = result.scalar()

                if not table_exists:
                    print(f"⏭️  {table}: table doesn't exist, skipping")
                    continue

                # Get row count
                result = neon_conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()

                if count == 0:
                    print(f"⏭️  {table}: 0 rows, skipping")
                    continue

                # Check if target already has data
                result_target = railway_conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                existing_count = result_target.scalar()

                if existing_count > 0:
                    print(f"⏭️  {table}: already has {existing_count} rows, skipping")
                    continue

                print(f"📦 {table}: migrating {count} rows...", end=" ", flush=True)

                # Get columns from both databases
                neon_cols = neon_conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = '{table}' ORDER BY ordinal_position
                """))
                neon_columns = [row[0] for row in neon_cols]

                railway_cols = railway_conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = '{table}' ORDER BY ordinal_position
                """))
                railway_columns = [row[0] for row in railway_cols]

                # Only use columns that exist in both databases
                common_columns = [col for col in neon_columns if col in railway_columns]

                # Fetch data with only common columns
                columns_str = ', '.join(common_columns)
                result = neon_conn.execute(text(f"SELECT {columns_str} FROM {table}"))
                rows = result.fetchall()
                columns = common_columns

                if rows:
                    # Disable triggers temporarily for faster insert
                    railway_conn.execute(text(f"ALTER TABLE {table} DISABLE TRIGGER ALL"))
                    railway_conn.commit()

                    # Insert in batches
                    batch_size = 100
                    for i in range(0, len(rows), batch_size):
                        batch = rows[i:i+batch_size]

                        # Build parameterized insert
                        placeholders = ", ".join([f":{col}" for col in columns])
                        insert_sql = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"

                        for row in batch:
                            row_dict = dict(zip(columns, row))
                            # Convert dict/list values to JSON strings
                            for key, value in row_dict.items():
                                if isinstance(value, (dict, list)):
                                    row_dict[key] = json.dumps(value)
                            railway_conn.execute(text(insert_sql), row_dict)

                    railway_conn.commit()

                    # Re-enable triggers
                    railway_conn.execute(text(f"ALTER TABLE {table} ENABLE TRIGGER ALL"))
                    railway_conn.commit()

                    total_rows += count
                    print("✅")
                else:
                    print("⏭️  (no data)")

    # Update sequences for auto-increment columns
    print()
    print("🔧 Updating sequences...")
    with railway_engine.connect() as railway_conn:
        # Update sequences for tables with auto-increment IDs
        for table in tables:
            try:
                # Check if table has an id column
                result = railway_conn.execute(text(f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = '{table}' AND column_name = 'id'
                """))
                if result.fetchone():
                    # Update sequence
                    railway_conn.execute(text(f"""
                        SELECT setval(
                            pg_get_serial_sequence('{table}', 'id'),
                            COALESCE((SELECT MAX(id) FROM {table}), 1),
                            true
                        )
                    """))
                    railway_conn.commit()
            except Exception as e:
                # Ignore errors for tables without sequences
                pass

    print()
    print("=" * 80)
    print(f"✅ Migration complete! Migrated {total_rows} total rows")
    print("=" * 80)

except Exception as e:
    print()
    print(f"❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

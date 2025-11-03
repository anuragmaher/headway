"""
Update workspace with Slack team ID
Run this script to connect your workspace to Slack
"""
import os
import sys
from sqlalchemy import create_engine, text

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:****@trolley.proxy.rlwy.net:14696/railway")
WORKSPACE_ID = "8102e640-140a-4857-a359-e8b1e22f8642"

# Get Slack team ID from command line or prompt
if len(sys.argv) > 1:
    SLACK_TEAM_ID = sys.argv[1]
else:
    SLACK_TEAM_ID = input("Enter your Slack Team ID (starts with T...): ").strip()

if not SLACK_TEAM_ID.startswith('T'):
    print("❌ Error: Slack Team ID should start with 'T'")
    sys.exit(1)

# Update workspace
try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(
            text("UPDATE workspaces SET slack_team_id = :team_id WHERE id = :workspace_id"),
            {"team_id": SLACK_TEAM_ID, "workspace_id": WORKSPACE_ID}
        )
        conn.commit()

        if result.rowcount > 0:
            print(f"✅ Updated workspace {WORKSPACE_ID}")
            print(f"   Slack Team ID: {SLACK_TEAM_ID}")

            # Verify
            check = conn.execute(
                text("SELECT name, slack_team_id FROM workspaces WHERE id = :workspace_id"),
                {"workspace_id": WORKSPACE_ID}
            ).fetchone()

            if check:
                print(f"   Workspace: {check[0]}")
                print(f"   Confirmed slack_team_id: {check[1]}")
        else:
            print(f"❌ Workspace {WORKSPACE_ID} not found")

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

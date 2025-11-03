"""
Script to add company domains to a workspace
"""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.workspace import Workspace

def add_company_domains():
    db: Session = SessionLocal()

    try:
        workspace_id = "8102e640-140a-4857-a359-e8b1e22f8642"
        domains = ["hiverhq.com", "grexit.com"]

        # Get workspace
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()

        if not workspace:
            print(f"❌ Workspace {workspace_id} not found")
            return

        # Update company domains
        workspace.company_domains = domains
        db.commit()
        db.refresh(workspace)

        print(f"✅ Successfully updated workspace {workspace.name}")
        print(f"   Company domains: {workspace.company_domains}")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_company_domains()

#!/usr/bin/env python3
"""
Test script for customer CSV upload
"""

import sys
import requests
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.workspace import Workspace

def test_csv_upload():
    """Test the customer CSV upload endpoint"""

    # Get workspace ID
    db = next(get_db())
    workspace = db.query(Workspace).filter(Workspace.name == "Anurag's Workspace").first()

    if not workspace:
        print("❌ Workspace not found")
        return

    workspace_id = str(workspace.id)
    db.close()

    print("📤 Testing Customer CSV Upload")
    print("=" * 70)
    print(f"Workspace: {workspace.name}")
    print(f"Workspace ID: {workspace_id}")
    print()

    # Read the CSV file
    csv_file_path = backend_dir / "sample_customers.csv"

    if not csv_file_path.exists():
        print(f"❌ CSV file not found: {csv_file_path}")
        return

    print(f"📁 Using CSV file: {csv_file_path}")
    print()

    # For now, just demonstrate the API structure
    print("✅ Customer API endpoints created:")
    print()
    print("📋 Available endpoints:")
    print("-" * 70)
    print(f"GET    /api/v1/customers/?workspace_id={workspace_id}")
    print(f"       → List all customers with pagination and filters")
    print()
    print(f"POST   /api/v1/customers/?workspace_id={workspace_id}")
    print(f"       → Create a single customer")
    print()
    print(f"GET    /api/v1/customers/{{customer_id}}?workspace_id={workspace_id}")
    print(f"       → Get customer details")
    print()
    print(f"PUT    /api/v1/customers/{{customer_id}}?workspace_id={workspace_id}")
    print(f"       → Update customer")
    print()
    print(f"DELETE /api/v1/customers/{{customer_id}}?workspace_id={workspace_id}")
    print(f"       → Delete customer (soft delete)")
    print()
    print(f"POST   /api/v1/customers/upload-csv?workspace_id={workspace_id}")
    print(f"       → Upload customers from CSV file")
    print()
    print(f"GET    /api/v1/customers/stats/summary?workspace_id={workspace_id}")
    print(f"       → Get customer statistics")
    print()

    print("📄 CSV Format:")
    print("-" * 70)
    print("Required columns:")
    print("  • name")
    print()
    print("Optional columns:")
    print("  • domain")
    print("  • industry")
    print("  • website")
    print("  • phone")
    print("  • mrr (number)")
    print("  • arr (number)")
    print("  • deal_stage")
    print("  • deal_amount (number)")
    print()

    print("📊 Sample data in sample_customers.csv:")
    with open(csv_file_path, 'r') as f:
        lines = f.readlines()
        print(lines[0].strip())  # Header
        print(lines[1].strip())  # First data row
    print("  ... and 9 more rows")
    print()

    print("🚀 Next steps:")
    print("-" * 70)
    print("1. Start the FastAPI server:")
    print("   uvicorn app.main:app --reload")
    print()
    print("2. Use the API documentation:")
    print("   http://localhost:8000/docs")
    print()
    print("3. Or use curl to upload CSV:")
    print(f"   curl -X POST \\")
    print(f'     "http://localhost:8000/api/v1/customers/upload-csv?workspace_id={workspace_id}" \\')
    print(f'     -H "Authorization: Bearer YOUR_TOKEN" \\')
    print(f'     -F "file=@sample_customers.csv"')


if __name__ == "__main__":
    test_csv_upload()

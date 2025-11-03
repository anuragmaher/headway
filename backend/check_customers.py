import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.customer import Customer

db = SessionLocal()
try:
    customers = db.query(Customer).filter(
        Customer.workspace_id == '8102e640-140a-4857-a359-e8b1e22f8642'
    ).all()
    
    print(f"\nTotal customers: {len(customers)}")
    print("\nAll customers:")
    for c in customers:
        print(f"  - {c.name} ({c.domain})")
    
    # Check specifically for internal domains
    internal = db.query(Customer).filter(
        Customer.workspace_id == '8102e640-140a-4857-a359-e8b1e22f8642',
        Customer.domain.in_(['hiverhq.com', 'grexit.com'])
    ).all()
    
    if internal:
        print(f"\n❌ Found {len(internal)} internal customer(s):")
        for c in internal:
            print(f"  - {c.name} ({c.domain})")
    else:
        print("\n✅ No internal customers (hiverhq.com or grexit.com) found!")
        
finally:
    db.close()

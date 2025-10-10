"""
Test dashboard metrics API endpoint
"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db
from app.models.user import User
from app.core.security import create_access_token
import requests
import json


def test_dashboard_metrics():
    """Test dashboard metrics endpoint"""

    # Get database session
    db = next(get_db())

    try:
        # Get a test user
        user = db.query(User).first()

        if not user:
            print("❌ No user found in database")
            return

        print(f"✓ Using user: {user.email}")

        # Create access token
        access_token = create_access_token(user.id)
        print(f"✓ Generated access token")

        # Test workspace ID
        workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

        # Make API request
        url = f"http://localhost:8000/api/v1/features/dashboard-metrics?workspace_id={workspace_id}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "accept": "application/json"
        }

        print(f"\n🔄 Testing endpoint: {url}\n")

        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()

            print("=" * 80)
            print("✅ Dashboard Metrics API Response:")
            print("=" * 80)

            # Top metrics
            print(f"\n📊 Top Metrics:")
            print(f"   Total Requests: {data.get('total_requests', 0)}")
            print(f"   Total MRR Impact: ${data.get('total_mrr_impact', 0):,.0f}")
            print(f"   Deal Blockers: {data.get('deal_blockers', 0)}")
            print(f"   Urgent Items: {data.get('urgent_items', 0)}")

            # By urgency
            print(f"\n🚨 By Urgency:")
            by_urgency = data.get('by_urgency', {})
            for urgency, stats in by_urgency.items():
                print(f"   {urgency}: {stats.get('count', 0)} requests (${stats.get('mrr', 0):,.0f} MRR)")

            # By customer type
            print(f"\n👥 By Customer Type:")
            by_customer_type = data.get('by_customer_type', {})
            for customer_type, stats in by_customer_type.items():
                print(f"   {customer_type}: {stats.get('count', 0)} requests (${stats.get('mrr', 0):,.0f} MRR)")

            # By product
            print(f"\n💼 By Product:")
            by_product = data.get('by_product', [])
            for product in by_product[:5]:  # Top 5
                print(f"   {product.get('product', 'N/A')}: {product.get('count', 0)} requests (${product.get('mrr', 0):,.0f} MRR)")

            # Top categories
            print(f"\n📂 Top Categories:")
            top_categories = data.get('top_categories', [])
            for category in top_categories[:5]:  # Top 5
                print(f"   {category.get('category', 'N/A')}: {category.get('count', 0)} requests (${category.get('mrr', 0):,.0f} MRR)")

            # Critical attention
            print(f"\n⚠️  Critical Attention Required:")
            critical_attention = data.get('critical_attention', [])
            if critical_attention:
                for item in critical_attention[:3]:  # Top 3
                    print(f"   {item.get('customer', 'N/A')} - ${item.get('mrr', 0):,.0f} - {item.get('feature', 'N/A')}")
            else:
                print(f"   No critical items")

            # Top 10 by MRR
            print(f"\n💰 Top 10 by MRR Impact:")
            top_10 = data.get('top_10_by_mrr', [])
            if top_10:
                for i, item in enumerate(top_10[:5], 1):  # Show first 5
                    print(f"   {i}. {item.get('customer', 'N/A')} - ${item.get('mrr', 0):,.0f} - {item.get('feature', 'N/A')[:50]}...")
            else:
                print(f"   No data")

            # Common deal blockers
            print(f"\n🚫 Common Deal Blockers:")
            deal_blockers = data.get('common_deal_blockers', [])
            if deal_blockers:
                for blocker in deal_blockers[:5]:  # Top 5
                    print(f"   {blocker.get('count', 0)}x {blocker.get('feature', 'N/A')}")
            else:
                print(f"   No deal blockers")

            # Key insights
            print(f"\n💡 Key Insights:")
            insights = data.get('key_insights', {})
            print(f"   Urgent/Important: {insights.get('urgent_important_percentage', 0)}%")
            print(f"   Gmail vs Outlook: {insights.get('gmail_vs_outlook_ratio', 0)}x")
            print(f"   Top Category: {insights.get('top_category', 'N/A')}")
            print(f"   Top Product: {insights.get('top_product', 'N/A')}")

            print("\n" + "=" * 80)
            print("✅ Dashboard metrics endpoint is working correctly!")
            print("=" * 80)

        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


if __name__ == "__main__":
    test_dashboard_metrics()

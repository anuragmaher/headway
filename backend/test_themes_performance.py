"""
Test themes endpoint performance
"""
import sys
import os
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_db
from app.models.user import User
from app.core.security import create_access_token
import requests


def test_themes_performance():
    """Test themes endpoint performance"""

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
        url = f"http://localhost:8000/api/v1/features/themes?workspace_id={workspace_id}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "accept": "application/json"
        }

        print(f"\n🔄 Testing endpoint: {url}\n")

        # Test 3 times to see consistency
        for i in range(3):
            start_time = time.time()
            response = requests.get(url, headers=headers, timeout=30)
            elapsed_time = time.time() - start_time

            if response.status_code == 200:
                data = response.json()
                theme_count = len(data) if isinstance(data, list) else 0
                print(f"✅ Test {i+1}: {response.status_code} - {elapsed_time:.3f}s - {theme_count} themes")
            else:
                print(f"❌ Test {i+1}: {response.status_code} - {elapsed_time:.3f}s")
                print(f"   Response: {response.text[:200]}")

            # Small delay between tests
            if i < 2:
                time.sleep(0.5)

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


if __name__ == "__main__":
    test_themes_performance()

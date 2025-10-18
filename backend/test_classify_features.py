#!/usr/bin/env python3
"""
Test the classify-features endpoint
"""

import requests

# API endpoint
url = "http://localhost:8000/api/v1/way/classify-features"

# Workspace ID
workspace_id = "647ab033-6d10-4a35-9ace-0399052ec874"

# Get auth token (you'll need to replace this with a valid token)
# For testing, you can get it from the frontend's localStorage or use a test user

params = {
    "workspace_id": workspace_id
}

headers = {
    "Authorization": "Bearer <your_token_here>"  # Replace with actual token
}

print("Calling classify-features endpoint...")
response = requests.post(url, params=params, headers=headers)

if response.status_code == 200:
    result = response.json()
    print(f"\n✅ Success!")
    print(f"Features created: {result['features_created']}")
    print(f"Features classified to themes: {result['features_classified']}")
    print(f"Features in Unclassified: {result['unclassified_count']}")
else:
    print(f"\n❌ Error: {response.status_code}")
    print(response.text)

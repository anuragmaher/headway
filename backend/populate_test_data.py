#!/usr/bin/env python3
"""
Script to populate the database with test data from data/dump.txt
This creates the necessary workspace, integration, and message records for clustering.
"""

import sys
import os
import json
from datetime import datetime
from sqlalchemy.orm import Session

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.company import Company
from app.models.workspace import Workspace
from app.models.integration import Integration
from app.models.message import Message


def parse_dump_file(file_path: str) -> list:
    """Parse the Slack data file and extract feature requests"""
    messages = []

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by line numbers (each line starts with a number)
    lines = content.strip().split('\n')

    for line in lines:
        if not line.strip():
            continue

        # Skip PDMR entries and other non-feature entries
        if '*** PDMR ***' in line or 'Deal lost because of feature gap' in line:
            continue

        # Parse feature request entries
        if 'Feature request from a company' in line:
            # Extract various fields using regex-like parsing
            import re

            # Parse customer name
            customer_match = re.search(r'\*Customer name\* - ([^*]+)', line)
            customer_name = customer_match.group(1).strip() if customer_match else "Unknown Customer"

            # Parse feature category
            category_match = re.search(r'\*Feature category\* - ([^*]+)', line)
            category = category_match.group(1).strip() if category_match else "Others"

            # Parse feature description
            desc_match = re.search(r'\*Feature description\* ([^*]+)', line)
            description = desc_match.group(1).strip() if desc_match else ""

            # Parse channel
            channel_match = re.search(r'\*Channel\* - ([^*]+)', line)
            channel = channel_match.group(1).strip() if channel_match else "general"

            # Parse MRR
            mrr_match = re.search(r'\*Associated MRR\* - (\d+)', line)
            mrr = mrr_match.group(1) if mrr_match else "0"

            # Parse urgency
            urgency_match = re.search(r'\*Urgency of ask\* - ([^*]+)', line)
            urgency = urgency_match.group(1).strip() if urgency_match else "Nice to have"

            # Parse product
            product_match = re.search(r'\*Product\* - ([^*\s]+)', line)
            product = product_match.group(1).strip() if product_match else "Gmail"

            # Parse requested by
            requested_match = re.search(r'\*Requested by\* - ([^*]+)', line)
            requested_by = requested_match.group(1).strip() if requested_match else "Unknown"

            # Clean up HTML entities and email formatting
            customer_name = re.sub(r'<[^>]+>', '', customer_name).replace('&amp;', '&')
            description = re.sub(r'<[^>]+>', '', description).replace('&amp;', '&')
            requested_by = re.sub(r'<[^>]+>', '', requested_by).replace('&amp;', '&')

            # Create message content
            content_parts = [
                f"Feature Request: {description}",
                f"Customer: {customer_name}",
                f"Category: {category}",
                f"Product: {product}",
                f"Urgency: {urgency}"
            ]

            if mrr != "0":
                content_parts.append(f"MRR: ${mrr}")

            message_data = {
                'customer_name': customer_name,
                'category': category,
                'description': description,
                'channel': channel,
                'mrr': mrr,
                'urgency': urgency,
                'product': product,
                'requested_by': requested_by
            }

            messages.append({
                'content': '\n'.join(content_parts),
                'channel_name': f"product-requests-{product.lower()}",
                'author_name': customer_name,
                'external_id': f'slack_msg_{len(messages)+1}',
                'metadata': message_data
            })

    return messages


def create_test_workspace_and_user(db: Session):
    """Create test company, user, workspace, and integration"""

    # Create test company
    company = Company(
        name="HeadwayHQ Test Company",
        size="11-50",
        domain="headwayhq.com",
        is_active=True,
        subscription_plan="free"
    )
    db.add(company)
    db.flush()

    # Create test user
    user = User(
        email="test@headwayhq.com",
        first_name="Test",
        last_name="User",
        job_title="Product Manager",
        company_id=company.id,
        role="owner",
        hashed_password="dummy_hash",  # This is just for testing
        is_active=True,
        onboarding_completed=True
    )
    db.add(user)
    db.flush()

    # Create test workspace
    workspace = Workspace(
        name="Test Workspace",
        slug="test-workspace",
        company_id=company.id,
        owner_id=user.id,
        is_active=True
    )
    db.add(workspace)
    db.flush()

    # Create test integration (simulating Slack)
    integration = Integration(
        name="Test Slack Integration",
        provider="slack",
        workspace_id=workspace.id,
        external_team_id="T1234567890",
        external_team_name="Test Slack Workspace",
        access_token="dummy_token",
        is_active=True
    )
    db.add(integration)
    db.flush()

    return workspace, integration


def populate_messages(db: Session, workspace: Workspace, integration: Integration, messages_data: list):
    """Populate the database with messages"""

    print(f"Creating {len(messages_data)} messages...")

    for i, msg_data in enumerate(messages_data):
        message = Message(
            external_id=msg_data['external_id'],
            content=msg_data['content'],
            source="slack",
            channel_name=msg_data['channel_name'],
            channel_id=f"C{str(i).zfill(8)}",
            author_name=msg_data['author_name'],
            author_id=f"U{str(i).zfill(8)}",
            message_metadata=msg_data['metadata'],
            workspace_id=workspace.id,
            integration_id=integration.id,
            sent_at=datetime.utcnow(),
            is_processed=False
        )
        db.add(message)

    db.commit()
    print(f"✅ Created {len(messages_data)} messages successfully!")


def main():
    """Main function to populate test data"""

    # Check if data file exists
    data_file = "../data/slack.txt"
    if not os.path.exists(data_file):
        print(f"❌ Data file {data_file} not found!")
        return

    # Parse messages from dump file
    print(f"📖 Reading messages from {data_file}...")
    messages_data = parse_dump_file(data_file)
    print(f"✅ Parsed {len(messages_data)} messages")

    # Create database session
    db = SessionLocal()

    try:
        # Check if test data already exists
        existing_workspace = db.query(Workspace).filter(
            Workspace.slug == "test-workspace"
        ).first()

        if existing_workspace:
            print("⚠️  Test workspace already exists. Using existing data.")
            workspace = existing_workspace
            integration = db.query(Integration).filter(
                Integration.workspace_id == workspace.id
            ).first()
        else:
            # Create test workspace and user
            print("🏗️  Creating test workspace and user...")
            workspace, integration = create_test_workspace_and_user(db)
            print(f"✅ Created workspace: {workspace.name}")

        # Check if messages already exist
        existing_messages = db.query(Message).filter(
            Message.workspace_id == workspace.id
        ).count()

        if existing_messages > 0:
            print(f"⚠️  {existing_messages} messages already exist in the workspace.")
            choice = input("Do you want to add more messages anyway? (y/N): ")
            if choice.lower() != 'y':
                print("Skipping message creation.")
                print(f"📊 Workspace ID: {workspace.id}")
                print(f"📊 Total messages in workspace: {existing_messages}")
                return

        # Populate messages
        populate_messages(db, workspace, integration, messages_data)

        # Final summary
        total_messages = db.query(Message).filter(
            Message.workspace_id == workspace.id
        ).count()

        print("\n🎉 Test data population completed!")
        print(f"📊 Workspace ID: {workspace.id}")
        print(f"📊 Total messages in workspace: {total_messages}")
        print(f"🚀 Ready to start clustering run!")

    except Exception as e:
        print(f"❌ Error populating test data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
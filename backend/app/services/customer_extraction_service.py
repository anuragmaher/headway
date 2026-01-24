"""
Customer Extraction Service - Extracts and creates customer records from message data.

This service:
1. Extracts customer info from email addresses and names
2. Finds or creates Customer records based on email/domain
3. Links messages to customers

Used by ingestion services (Gmail, Slack, etc.) to automatically populate the customers table.
"""

import logging
import re
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.customer import Customer
from app.models.message import Message

logger = logging.getLogger(__name__)


class CustomerExtractionService:
    """Service for extracting and managing customer records from messages."""

    # Common email domains that should NOT be treated as company domains
    PERSONAL_EMAIL_DOMAINS = {
        "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
        "icloud.com", "mail.com", "protonmail.com", "zoho.com", "yandex.com",
        "live.com", "msn.com", "me.com", "mac.com", "qq.com", "163.com",
        "126.com", "sina.com", "googlemail.com", "hey.com", "pm.me",
        "tutanota.com", "fastmail.com", "fastmail.fm"
    }

    def extract_domain_from_email(self, email: str) -> Optional[str]:
        """
        Extract domain from email address.

        Args:
            email: Email address string

        Returns:
            Domain string or None if not extractable
        """
        if not email:
            return None

        try:
            # Handle "Name <email@domain.com>" format
            match = re.search(r'[\w\.-]+@([\w\.-]+\.\w+)', email)
            if match:
                domain = match.group(1).lower()
                return domain
            return None
        except Exception:
            return None

    def is_personal_email(self, email: str) -> bool:
        """Check if email is from a personal email provider."""
        domain = self.extract_domain_from_email(email)
        if not domain:
            return True  # Treat unknown as personal
        return domain.lower() in self.PERSONAL_EMAIL_DOMAINS

    def extract_customer_info(
        self,
        from_email: Optional[str],
        from_name: Optional[str],
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Extract customer information from email fields.

        Args:
            from_email: Sender email address
            from_name: Sender name

        Returns:
            Tuple of (email, name, domain)
        """
        email = None
        name = from_name
        domain = None

        if from_email:
            # Extract clean email
            match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', from_email)
            if match:
                email = match.group(0).lower()
                domain = self.extract_domain_from_email(email)

                # If domain is personal, don't use it as company identifier
                if domain and domain in self.PERSONAL_EMAIL_DOMAINS:
                    domain = None

        return email, name, domain

    def find_or_create_customer(
        self,
        db: Session,
        workspace_id: UUID,
        email: Optional[str],
        name: Optional[str],
        domain: Optional[str] = None,
    ) -> Optional[UUID]:
        """
        Find existing customer or create new one.

        Priority for matching:
        1. Exact email match (contact_email)
        2. Domain match (for business emails)
        3. Name match (within workspace)

        Args:
            db: Database session
            workspace_id: Workspace ID
            email: Customer email
            name: Customer name
            domain: Company domain (extracted from email)

        Returns:
            Customer ID or None
        """
        if not email and not name:
            return None

        try:
            # Try to find existing customer
            customer = None

            # 1. Match by email
            if email:
                customer = db.query(Customer).filter(
                    and_(
                        Customer.workspace_id == workspace_id,
                        Customer.contact_email == email
                    )
                ).first()

            # 2. Match by domain (for business emails)
            if not customer and domain and domain not in self.PERSONAL_EMAIL_DOMAINS:
                customer = db.query(Customer).filter(
                    and_(
                        Customer.workspace_id == workspace_id,
                        Customer.domain == domain
                    )
                ).first()

                # Update contact info if we found by domain
                if customer and email and not customer.contact_email:
                    customer.contact_email = email
                    if name and not customer.contact_name:
                        customer.contact_name = name
                    db.flush()

            # 3. Create new customer if not found
            if not customer:
                # Determine customer name
                customer_name = name
                if not customer_name and domain:
                    # Use domain as company name (capitalize it)
                    customer_name = domain.split('.')[0].capitalize()
                if not customer_name:
                    customer_name = email.split('@')[0] if email else "Unknown"

                customer = Customer(
                    workspace_id=workspace_id,
                    name=customer_name,
                    domain=domain,
                    contact_email=email,
                    contact_name=name,
                    external_system="email",  # Mark as auto-extracted from email
                    is_active=True,
                )
                db.add(customer)
                db.flush()  # Get the ID without committing

                logger.info(f"Created new customer: {customer_name} ({email}) for workspace {workspace_id}")

            return customer.id

        except Exception as e:
            logger.error(f"Error finding/creating customer: {e}")
            return None

    def link_message_to_customer(
        self,
        db: Session,
        message: Message,
    ) -> Optional[UUID]:
        """
        Extract customer from message and link them.

        Args:
            db: Database session
            message: Message to process

        Returns:
            Customer ID if linked, None otherwise
        """
        if not message.workspace_id:
            return None

        # Extract customer info from message
        from_email = message.from_email or message.author_email
        from_name = message.author_name

        email, name, domain = self.extract_customer_info(from_email, from_name)

        if not email and not name:
            return None

        # Find or create customer
        customer_id = self.find_or_create_customer(
            db=db,
            workspace_id=message.workspace_id,
            email=email,
            name=name,
            domain=domain,
        )

        if customer_id:
            message.customer_id = customer_id

        return customer_id

    def process_messages_for_customers(
        self,
        db: Session,
        workspace_id: UUID,
        batch_size: int = 100,
    ) -> dict:
        """
        Process messages without customer links and create/link customers.

        Args:
            db: Database session
            workspace_id: Workspace to process
            batch_size: Number of messages to process

        Returns:
            Dict with stats
        """
        stats = {"processed": 0, "linked": 0, "errors": 0}

        try:
            # Get messages without customer_id
            messages = db.query(Message).filter(
                and_(
                    Message.workspace_id == workspace_id,
                    Message.customer_id.is_(None),
                    or_(
                        Message.from_email.isnot(None),
                        Message.author_email.isnot(None),
                        Message.author_name.isnot(None),
                    )
                )
            ).limit(batch_size).all()

            for message in messages:
                stats["processed"] += 1
                try:
                    customer_id = self.link_message_to_customer(db, message)
                    if customer_id:
                        stats["linked"] += 1
                except Exception as e:
                    logger.error(f"Error linking message {message.id} to customer: {e}")
                    stats["errors"] += 1

            db.commit()

            logger.info(
                f"Customer extraction complete for workspace {workspace_id}: "
                f"{stats['linked']}/{stats['processed']} linked"
            )

        except Exception as e:
            logger.error(f"Error in batch customer extraction: {e}")
            db.rollback()

        return stats


# Global service instance
customer_extraction_service = CustomerExtractionService()

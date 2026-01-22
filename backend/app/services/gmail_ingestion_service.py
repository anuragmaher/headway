"""
Gmail Ingestion Service - Fetches email threads from selected labels for AI processing
"""

import logging
import base64
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from email.utils import parsedate_to_datetime

from app.models.workspace_connector import WorkspaceConnector
from app.models.connector_label import ConnectorLabel
from app.models.message import Message
from app.services.gmail_client import get_gmail_client

logger = logging.getLogger(__name__)


class GmailIngestionService:
    """Service for ingesting Gmail threads from selected labels"""

    # Memory optimization constants
    MAX_CONTENT_LENGTH = 50000  # Max characters for thread content (50KB)
    MAX_MESSAGE_BODY_LENGTH = 10000  # Max characters per individual message body

    def __init__(self):
        self.max_threads_per_label = 5  # Fetch last 5 threads per label

    def ingest_threads_for_connector(
        self,
        connector_id: str,
        db: Session,
        max_threads: int = 5
    ) -> Dict[str, Any]:
        """
        Ingest threads from all selected labels for a Gmail connector

        Args:
            connector_id: The connector ID
            db: Database session
            max_threads: Maximum threads to fetch per label (default: 5)

        Returns:
            Dict with status and count of ingested threads
        """
        try:
            # Get the Gmail connector
            connector = db.query(WorkspaceConnector).filter(
                WorkspaceConnector.id == UUID(connector_id) if isinstance(connector_id, str) else connector_id,
                WorkspaceConnector.connector_type == 'gmail'
            ).first()

            if not connector:
                logger.error(f"Gmail connector {connector_id} not found")
                return {"status": "error", "error": "Gmail connector not found", "count": 0, "total_checked": 0, "new_added": 0}

            # Update sync status
            connector.sync_status = "syncing"
            db.commit()

            # Get selected labels for this connector
            labels = db.query(ConnectorLabel).filter(
                ConnectorLabel.connector_id == connector.id,
                ConnectorLabel.is_enabled == True
            ).all()

            if not labels:
                logger.warning(f"No labels selected for Gmail connector {connector_id}")
                connector.sync_status = "success"
                connector.last_synced_at = datetime.now(timezone.utc)
                db.commit()
                return {"status": "success", "count": 0, "total_checked": 0, "new_added": 0, "message": "No labels selected"}

            # Get Gmail client
            gmail_client = get_gmail_client(connector, db)

            total_checked = 0
            total_new = 0
            errors = []

            # Process each label
            for label in labels:
                try:
                    logger.info(f"Fetching threads from label: {label.label_name} ({label.label_id})")

                    result = self._fetch_threads_from_label(
                        gmail_client=gmail_client,
                        connector=connector,
                        label=label,
                        db=db,
                        max_threads=max_threads
                    )

                    total_checked += result.get("total_checked", 0)
                    total_new += result.get("new_added", 0)
                    logger.info(f"Checked {result.get('total_checked', 0)} threads, added {result.get('new_added', 0)} new from label {label.label_name}")

                except Exception as e:
                    error_msg = f"Error fetching threads from label {label.label_name}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    continue

            # Update sync status
            connector.sync_status = "success" if not errors else "partial"
            connector.sync_error = "; ".join(errors) if errors else None
            connector.last_synced_at = datetime.now(timezone.utc)
            db.commit()

            logger.info(f"Gmail ingestion complete. Checked {total_checked}, added {total_new} new threads")

            return {
                "status": "success" if not errors else "partial",
                "total_checked": total_checked,
                "new_added": total_new,
                "count": total_new,  # Keep for backward compatibility
                "errors": errors if errors else None
            }

        except Exception as e:
            logger.error(f"Fatal error in Gmail ingestion: {str(e)}")

            # Update sync status
            if 'connector' in locals() and connector:
                connector.sync_status = "error"
                connector.sync_error = str(e)
                db.commit()

            return {"status": "error", "error": str(e), "count": 0, "total_checked": 0, "new_added": 0}

    # Keep old method name for backward compatibility
    def ingest_threads_for_account(
        self,
        gmail_account_id: str,
        db: Session,
        max_threads: int = 5
    ) -> Dict[str, Any]:
        """Backward compatible method - calls ingest_threads_for_connector"""
        return self.ingest_threads_for_connector(gmail_account_id, db, max_threads)
    
    def _fetch_threads_from_label(
        self,
        gmail_client,
        connector: WorkspaceConnector,
        label: ConnectorLabel,
        db: Session,
        max_threads: int = 5
    ) -> Dict[str, int]:
        """
        Fetch threads from a specific label

        Args:
            gmail_client: Gmail API client
            connector: WorkspaceConnector model
            label: ConnectorLabel model
            db: Database session
            max_threads: Maximum threads to fetch

        Returns:
            Dictionary with 'total_checked' and 'new_added' counts
        """
        total_checked = 0
        new_added = 0

        try:
            # List threads with the specified label
            results = gmail_client.users().threads().list(
                userId="me",
                labelIds=[label.label_id],
                maxResults=max_threads
            ).execute()

            threads = results.get("threads", [])

            if not threads:
                logger.info(f"No threads found in label {label.label_name}")
                return {"total_checked": 0, "new_added": 0}

            total_checked = len(threads)

            # Process each thread
            for thread_info in threads:
                try:
                    thread_id = thread_info["id"]

                    # Check if thread already exists (using Message table)
                    existing = db.query(Message).filter(
                        Message.connector_id == connector.id,
                        Message.thread_id == thread_id,
                        Message.source == 'gmail'
                    ).first()

                    if existing:
                        logger.debug(f"Thread {thread_id} already exists, skipping")
                        continue

                    # Get full thread details
                    thread_data = gmail_client.users().threads().get(
                        userId="me",
                        id=thread_id,
                        format="full"
                    ).execute()

                    # Parse thread and create message record
                    message_record = self._parse_thread(
                        thread_data=thread_data,
                        connector=connector,
                        label=label
                    )

                    if message_record:
                        db.add(message_record)
                        new_added += 1

                except Exception as e:
                    logger.error(f"Error processing thread {thread_info.get('id', 'unknown')}: {str(e)}")
                    continue

            # Commit all messages for this label
            db.commit()

        except Exception as e:
            logger.error(f"Error fetching threads from label {label.label_name}: {str(e)}")
            db.rollback()
            raise

        return {"total_checked": total_checked, "new_added": new_added}
    
    def _parse_thread(
        self,
        thread_data: Dict[str, Any],
        connector: WorkspaceConnector,
        label: ConnectorLabel
    ) -> Optional[Message]:
        """
        Parse Gmail thread data into a Message model

        Args:
            thread_data: Raw thread data from Gmail API
            connector: WorkspaceConnector model
            label: ConnectorLabel model

        Returns:
            Message model or None if parsing fails
        """
        try:
            messages = thread_data.get("messages", [])

            if not messages:
                return None

            # Get the first message for thread metadata
            first_message = messages[0]
            latest_message = messages[-1]

            # Extract headers
            headers = {
                h["name"].lower(): h["value"]
                for h in first_message.get("payload", {}).get("headers", [])
            }

            # Parse From field
            from_header = headers.get("from", "")
            from_name, from_email = self._parse_email_address(from_header)

            # Parse To field
            to_header = headers.get("to", "")

            # Get subject
            subject = headers.get("subject", "(No Subject)")

            # Get thread date from latest message
            thread_date = None
            latest_headers = {
                h["name"].lower(): h["value"]
                for h in latest_message.get("payload", {}).get("headers", [])
            }
            date_str = latest_headers.get("date")
            if date_str:
                try:
                    thread_date = parsedate_to_datetime(date_str)
                except Exception:
                    thread_date = datetime.now(timezone.utc)

            # Extract and concatenate all message bodies
            content_parts = []
            for msg in messages:
                body = self._extract_message_body(msg)
                if body:
                    # Add message metadata
                    msg_headers = {
                        h["name"].lower(): h["value"]
                        for h in msg.get("payload", {}).get("headers", [])
                    }
                    msg_from = msg_headers.get("from", "Unknown")
                    msg_date = msg_headers.get("date", "")

                    content_parts.append(f"--- From: {msg_from} | Date: {msg_date} ---\n{body}")

            full_content = "\n\n".join(content_parts)

            # Truncate full content to prevent memory issues with very long threads
            if len(full_content) > self.MAX_CONTENT_LENGTH:
                full_content = full_content[:self.MAX_CONTENT_LENGTH] + "\n\n... [content truncated for storage efficiency]"

            # Create Message record (replaces GmailThread)
            return Message(
                workspace_id=connector.workspace_id,
                connector_id=connector.id,
                source='gmail',
                external_id=thread_data["id"],
                thread_id=thread_data["id"],
                content=full_content,
                title=subject[:500] if subject else None,
                label_name=label.label_name,
                author_name=from_name[:255] if from_name else None,
                author_email=from_email[:255] if from_email else None,
                from_email=from_email[:255] if from_email else None,
                to_emails=to_header,
                message_count=len(messages),
                sent_at=thread_date,
                is_processed=False,
                created_at=datetime.now(timezone.utc)
            )

        except Exception as e:
            logger.error(f"Error parsing thread: {str(e)}")
            return None
    
    def _extract_message_body(self, message: Dict[str, Any]) -> str:
        """
        Extract the body text from a Gmail message with truncation for memory efficiency

        Args:
            message: Gmail message data

        Returns:
            Extracted body text (truncated to MAX_MESSAGE_BODY_LENGTH)
        """
        try:
            payload = message.get("payload", {})
            body_text = ""

            # Try to get body directly
            body_data = payload.get("body", {}).get("data")
            if body_data:
                body_text = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="ignore")
            else:
                # Check for multipart message
                parts = payload.get("parts", [])
                for part in parts:
                    mime_type = part.get("mimeType", "")

                    # Prefer plain text
                    if mime_type == "text/plain":
                        data = part.get("body", {}).get("data")
                        if data:
                            body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                            break

                    # Check nested parts
                    nested_parts = part.get("parts", [])
                    for nested in nested_parts:
                        if nested.get("mimeType") == "text/plain":
                            data = nested.get("body", {}).get("data")
                            if data:
                                body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                                break
                    if body_text:
                        break

                # Fallback to HTML and strip tags
                if not body_text:
                    for part in parts:
                        if part.get("mimeType") == "text/html":
                            data = part.get("body", {}).get("data")
                            if data:
                                html = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                                body_text = self._strip_html_tags(html)
                                break

                # Use snippet as last resort
                if not body_text:
                    body_text = message.get("snippet", "")

            # Truncate to save memory
            if len(body_text) > self.MAX_MESSAGE_BODY_LENGTH:
                body_text = body_text[:self.MAX_MESSAGE_BODY_LENGTH] + "... [truncated]"

            return body_text

        except Exception as e:
            logger.warning(f"Error extracting message body: {str(e)}")
            return message.get("snippet", "")
    
    def _strip_html_tags(self, html: str) -> str:
        """Strip HTML tags from text"""
        clean = re.compile('<.*?>')
        text = re.sub(clean, '', html)
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def _parse_email_address(self, address: str) -> tuple:
        """
        Parse an email address string into name and email parts
        
        Args:
            address: Email address string (e.g., "John Doe <john@example.com>")
            
        Returns:
            Tuple of (name, email)
        """
        try:
            # Match pattern: "Name <email@domain.com>" or just "email@domain.com"
            match = re.match(r'^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$', address.strip())
            if match:
                name = match.group(1).strip() if match.group(1) else None
                email = match.group(2).strip() if match.group(2) else address
                return (name, email)
            return (None, address)
        except Exception:
            return (None, address)


# Global service instance
gmail_ingestion_service = GmailIngestionService()

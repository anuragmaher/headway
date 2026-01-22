"""
Optimized Gmail Batch Ingestion Service - Fast batch data storage without AI extraction.

This service focuses on:
1. Fast fetching of Gmail threads from selected labels
2. Batch insertion into the Messages table
3. Deferred AI processing (marked as is_processed=False)

AI extraction happens in a separate batch processing task.

Usage:
    from app.services.gmail_batch_ingestion_service import gmail_batch_ingestion_service

    result = gmail_batch_ingestion_service.ingest_messages_for_connector(
        connector_id="...",
        db=db,
        max_messages=10
    )
"""

import logging
import base64
import re
import uuid as uuid_module
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from email.utils import parsedate_to_datetime
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.workspace_connector import WorkspaceConnector
from app.models.connector_label import ConnectorLabel
from app.models.message import Message
from app.services.gmail_client import get_gmail_client

logger = logging.getLogger(__name__)


class GmailBatchIngestionService:
    """
    Optimized Gmail ingestion service with batch operations.

    Key optimizations:
    - Batch check for existing threads before fetching
    - Bulk insert new messages
    - No inline AI extraction (deferred to batch processing)
    - Memory-efficient content truncation
    """

    # Memory optimization constants
    MAX_CONTENT_LENGTH = 50000  # Max characters for thread content (50KB)
    MAX_MESSAGE_BODY_LENGTH = 10000  # Max characters per individual message body
    DEFAULT_BATCH_SIZE = 50

    def ingest_messages_for_connector(
        self,
        connector_id: str,
        db: Session,
        max_messages: int = 10
    ) -> Dict[str, Any]:
        """
        Ingest messages from all enabled labels for a Gmail connector.

        This method:
        1. Gets enabled labels for the connector
        2. Checks existing threads in batch
        3. Fetches only new threads from Gmail API
        4. Batch inserts into Messages table with is_processed=False

        AI extraction is NOT performed here - it happens in a separate task.

        Args:
            connector_id: The WorkspaceConnector ID
            db: Database session
            max_messages: Maximum threads to fetch per label

        Returns:
            Dict with status and counts
        """
        try:
            # Get the Gmail connector
            connector = db.query(WorkspaceConnector).filter(
                and_(
                    WorkspaceConnector.id == connector_id,
                    WorkspaceConnector.connector_type == "gmail"
                )
            ).first()

            if not connector:
                logger.error(f"Gmail connector {connector_id} not found")
                return {
                    "status": "error",
                    "error": "Gmail connector not found",
                    "total_checked": 0,
                    "new_added": 0,
                    "duplicates_skipped": 0,
                    "inserted_ids": []
                }

            # Update sync status
            connector.sync_status = "syncing"
            db.commit()

            # Get enabled labels for this connector
            labels = db.query(ConnectorLabel).filter(
                and_(
                    ConnectorLabel.connector_id == connector.id,
                    ConnectorLabel.is_enabled == True
                )
            ).all()

            if not labels:
                logger.info(f"No labels enabled for Gmail connector {connector_id}")
                connector.sync_status = "success"
                connector.last_synced_at = datetime.now(timezone.utc)
                db.commit()
                return {
                    "status": "success",
                    "total_checked": 0,
                    "new_added": 0,
                    "duplicates_skipped": 0,
                    "inserted_ids": [],
                    "message": "No labels enabled"
                }

            # Get Gmail client
            gmail_client = get_gmail_client(connector, db)

            total_checked = 0
            total_new = 0
            total_skipped = 0
            all_inserted_ids: List[str] = []
            errors = []

            # Process each label
            for label in labels:
                try:
                    logger.info(f"Fetching threads from label: {label.label_name}")

                    result = self._batch_fetch_threads_from_label(
                        gmail_client=gmail_client,
                        connector=connector,
                        label=label,
                        db=db,
                        max_threads=max_messages
                    )

                    total_checked += result.get("total_checked", 0)
                    total_new += result.get("new_added", 0)
                    total_skipped += result.get("duplicates_skipped", 0)
                    all_inserted_ids.extend(result.get("inserted_ids", []))

                    logger.info(
                        f"Label {label.label_name}: checked {result.get('total_checked', 0)}, "
                        f"added {result.get('new_added', 0)}, skipped {result.get('duplicates_skipped', 0)}"
                    )

                except Exception as e:
                    error_msg = f"Error fetching from label {label.label_name}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    continue

            # Update sync status
            connector.sync_status = "success" if not errors else "partial"
            connector.sync_error = "; ".join(errors) if errors else None
            connector.last_synced_at = datetime.now(timezone.utc)
            db.commit()

            logger.info(
                f"Gmail ingestion complete: {total_new} new, {total_skipped} skipped "
                f"out of {total_checked} checked"
            )

            return {
                "status": "success" if not errors else "partial",
                "total_checked": total_checked,
                "new_added": total_new,
                "duplicates_skipped": total_skipped,
                "inserted_ids": all_inserted_ids,
                "errors": errors if errors else None
            }

        except Exception as e:
            logger.error(f"Fatal error in Gmail ingestion: {str(e)}")

            if 'connector' in locals() and connector:
                connector.sync_status = "error"
                connector.sync_error = str(e)
                db.commit()

            return {
                "status": "error",
                "error": str(e),
                "total_checked": 0,
                "new_added": 0,
                "duplicates_skipped": 0,
                "inserted_ids": []
            }

    def _batch_fetch_threads_from_label(
        self,
        gmail_client,
        connector: WorkspaceConnector,
        label: ConnectorLabel,
        db: Session,
        max_threads: int = 10
    ) -> Dict[str, Any]:
        """
        Batch fetch threads from a label with efficient duplicate detection.

        Args:
            gmail_client: Gmail API client
            connector: WorkspaceConnector model
            label: ConnectorLabel model
            db: Database session
            max_threads: Maximum threads to fetch

        Returns:
            Dict with counts and inserted_ids
        """
        try:
            # Step 1: List thread IDs from Gmail
            results = gmail_client.users().threads().list(
                userId="me",
                labelIds=[label.label_id],
                maxResults=max_threads
            ).execute()

            threads = results.get("threads", [])

            if not threads:
                logger.info(f"No threads found in label {label.label_name}")
                return {"total_checked": 0, "new_added": 0, "duplicates_skipped": 0, "inserted_ids": []}

            total_checked = len(threads)
            thread_ids = [t["id"] for t in threads]

            # Step 2: Batch check for existing threads (using external_id = thread_id)
            existing_thread_ids = self._get_existing_thread_ids(
                db=db,
                connector_id=connector.id,
                thread_ids=thread_ids
            )

            # Step 3: Filter to only new threads
            new_thread_ids = [tid for tid in thread_ids if tid not in existing_thread_ids]
            duplicates_skipped = len(existing_thread_ids)

            if not new_thread_ids:
                logger.info(f"All {total_checked} threads already exist in {label.label_name}")
                return {
                    "total_checked": total_checked,
                    "new_added": 0,
                    "duplicates_skipped": duplicates_skipped,
                    "inserted_ids": []
                }

            # Step 4: Fetch full details for new threads only
            message_records = []
            inserted_ids: List[str] = []
            for thread_id in new_thread_ids:
                try:
                    thread_data = gmail_client.users().threads().get(
                        userId="me",
                        id=thread_id,
                        format="full"
                    ).execute()

                    record = self._parse_thread_to_message(
                        thread_data=thread_data,
                        connector=connector,
                        label=label
                    )

                    if record:
                        # Pre-generate UUID for tracking
                        record.id = uuid_module.uuid4()
                        inserted_ids.append(str(record.id))
                        message_records.append(record)

                except Exception as e:
                    logger.error(f"Error fetching thread {thread_id}: {str(e)}")
                    continue

            # Step 5: Batch insert new messages
            if message_records:
                db.bulk_save_objects(message_records)
                db.commit()
                logger.info(f"Batch inserted {len(message_records)} messages for {label.label_name}")

            return {
                "total_checked": total_checked,
                "new_added": len(message_records),
                "duplicates_skipped": duplicates_skipped,
                "inserted_ids": inserted_ids
            }

        except Exception as e:
            logger.error(f"Error in batch fetch for label {label.label_name}: {str(e)}")
            db.rollback()
            raise

    def _get_existing_thread_ids(
        self,
        db: Session,
        connector_id: UUID,
        thread_ids: List[str]
    ) -> Set[str]:
        """Get set of thread IDs that already exist in database (using external_id)."""
        if not thread_ids:
            return set()

        try:
            # Check both external_id (for Gmail thread ID) and thread_id field
            existing = db.query(Message.external_id).filter(
                and_(
                    Message.connector_id == connector_id,
                    Message.external_id.in_(thread_ids)
                )
            ).all()

            return {row[0] for row in existing}

        except Exception as e:
            logger.error(f"Error checking existing threads: {e}")
            return set()

    def _parse_thread_to_message(
        self,
        thread_data: Dict[str, Any],
        connector: WorkspaceConnector,
        label: ConnectorLabel
    ) -> Optional[Message]:
        """Parse Gmail thread data into a Message model."""
        try:
            messages = thread_data.get("messages", [])

            if not messages:
                return None

            # Get the first and latest message
            first_message = messages[0]
            latest_message = messages[-1]

            # Extract headers from first message
            headers = {
                h["name"].lower(): h["value"]
                for h in first_message.get("payload", {}).get("headers", [])
            }

            # Parse From field
            from_header = headers.get("from", "")
            from_name, from_email = self._parse_email_address(from_header)

            # Get To and Subject
            to_header = headers.get("to", "")
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
                    msg_headers = {
                        h["name"].lower(): h["value"]
                        for h in msg.get("payload", {}).get("headers", [])
                    }
                    msg_from = msg_headers.get("from", "Unknown")
                    msg_date = msg_headers.get("date", "")
                    content_parts.append(f"--- From: {msg_from} | Date: {msg_date} ---\n{body}")

            full_content = "\n\n".join(content_parts)

            # Truncate to prevent memory issues
            if len(full_content) > self.MAX_CONTENT_LENGTH:
                full_content = full_content[:self.MAX_CONTENT_LENGTH] + "\n\n... [truncated]"

            snippet = thread_data.get("snippet", "")

            return Message(
                workspace_id=connector.workspace_id,
                connector_id=connector.id,
                source="gmail",
                external_id=thread_data["id"],  # Gmail thread ID
                thread_id=thread_data["id"],  # Also store in thread_id for duplicate detection
                title=subject[:500] if subject else None,
                content=full_content or snippet,
                label_name=label.label_name,
                author_name=from_name[:255] if from_name else None,
                author_email=from_email[:255] if from_email else None,
                from_email=from_email[:255] if from_email else None,
                to_emails=to_header,
                message_count=len(messages),
                message_metadata={
                    "snippet": snippet[:500] if snippet else None,
                    "label_id": label.label_id,
                },
                sent_at=thread_date,
                is_processed=False
            )

        except Exception as e:
            logger.error(f"Error parsing thread: {str(e)}")
            return None

    def _extract_message_body(self, message: Dict[str, Any]) -> str:
        """Extract the body text from a Gmail message with truncation."""
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

                # Fallback to HTML
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

            # Truncate
            if len(body_text) > self.MAX_MESSAGE_BODY_LENGTH:
                body_text = body_text[:self.MAX_MESSAGE_BODY_LENGTH] + "... [truncated]"

            return body_text

        except Exception as e:
            logger.warning(f"Error extracting message body: {str(e)}")
            return message.get("snippet", "")

    def _strip_html_tags(self, html: str) -> str:
        """Strip HTML tags from text."""
        clean = re.compile('<.*?>')
        text = re.sub(clean, '', html)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _parse_email_address(self, address: str) -> tuple:
        """Parse an email address string into name and email parts."""
        try:
            match = re.match(r'^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$', address.strip())
            if match:
                name = match.group(1).strip() if match.group(1) else None
                email = match.group(2).strip() if match.group(2) else address
                return (name, email)
            return (None, address)
        except Exception:
            return (None, address)


# Global service instance
gmail_batch_ingestion_service = GmailBatchIngestionService()

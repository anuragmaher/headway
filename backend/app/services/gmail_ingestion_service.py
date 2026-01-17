"""
Gmail Ingestion Service - Fetches email threads from selected labels for AI processing
"""

import logging
import base64
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from email.utils import parsedate_to_datetime

from app.models.gmail import GmailAccounts, GmailLabels, GmailThread
from app.services.gmail_client import get_gmail_client

logger = logging.getLogger(__name__)


class GmailIngestionService:
    """Service for ingesting Gmail threads from selected labels"""
    
    def __init__(self):
        self.max_threads_per_label = 5  # Fetch last 5 threads per label
    
    def ingest_threads_for_account(
        self, 
        gmail_account_id: str, 
        db: Session,
        max_threads: int = 5
    ) -> Dict[str, Any]:
        """
        Ingest threads from all selected labels for a Gmail account
        
        Args:
            gmail_account_id: The Gmail account ID
            db: Database session
            max_threads: Maximum threads to fetch per label (default: 5)
            
        Returns:
            Dict with status and count of ingested threads
        """
        try:
            # Get the Gmail account
            gmail_account = db.query(GmailAccounts).filter(
                GmailAccounts.id == gmail_account_id
            ).first()
            
            if not gmail_account:
                logger.error(f"Gmail account {gmail_account_id} not found")
                return {"status": "error", "error": "Gmail account not found", "count": 0, "total_checked": 0, "new_added": 0}
            
            # Update sync status
            gmail_account.sync_status = "syncing"
            db.commit()
            
            # Get selected labels for this account
            labels = db.query(GmailLabels).filter(
                GmailLabels.gmail_account_id == gmail_account.id,
                GmailLabels.watch_enabled == True
            ).all()
            
            if not labels:
                logger.warning(f"No labels selected for Gmail account {gmail_account_id}")
                gmail_account.sync_status = "success"
                gmail_account.last_synced_at = datetime.now(timezone.utc)
                db.commit()
                return {"status": "success", "count": 0, "total_checked": 0, "new_added": 0, "message": "No labels selected"}
            
            # Get Gmail client
            gmail_client = get_gmail_client(gmail_account, db)

            total_checked = 0
            total_new = 0
            errors = []

            # Process each label
            for label in labels:
                try:
                    logger.info(f"Fetching threads from label: {label.label_name} ({label.label_id})")

                    result = self._fetch_threads_from_label(
                        gmail_client=gmail_client,
                        gmail_account=gmail_account,
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
            gmail_account.sync_status = "success" if not errors else "partial"
            gmail_account.sync_error = "; ".join(errors) if errors else None
            gmail_account.last_synced_at = datetime.now(timezone.utc)
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
            if 'gmail_account' in locals() and gmail_account:
                gmail_account.sync_status = "error"
                gmail_account.sync_error = str(e)
                db.commit()
            
            return {"status": "error", "error": str(e), "count": 0, "total_checked": 0, "new_added": 0}
    
    def _fetch_threads_from_label(
        self,
        gmail_client,
        gmail_account: GmailAccounts,
        label: GmailLabels,
        db: Session,
        max_threads: int = 5
    ) -> Dict[str, int]:
        """
        Fetch threads from a specific label

        Args:
            gmail_client: Gmail API client
            gmail_account: Gmail account model
            label: Gmail label model
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

                    # Check if thread already exists
                    existing = db.query(GmailThread).filter(
                        GmailThread.gmail_account_id == gmail_account.id,
                        GmailThread.thread_id == thread_id
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

                    # Parse thread and create record
                    thread_record = self._parse_thread(
                        thread_data=thread_data,
                        gmail_account=gmail_account,
                        label=label
                    )

                    if thread_record:
                        db.add(thread_record)
                        new_added += 1

                except Exception as e:
                    logger.error(f"Error processing thread {thread_info.get('id', 'unknown')}: {str(e)}")
                    continue

            # Commit all threads for this label
            db.commit()

        except Exception as e:
            logger.error(f"Error fetching threads from label {label.label_name}: {str(e)}")
            db.rollback()
            raise

        return {"total_checked": total_checked, "new_added": new_added}
    
    def _parse_thread(
        self,
        thread_data: Dict[str, Any],
        gmail_account: GmailAccounts,
        label: GmailLabels
    ) -> Optional[GmailThread]:
        """
        Parse Gmail thread data into a GmailThread model
        
        Args:
            thread_data: Raw thread data from Gmail API
            gmail_account: Gmail account model
            label: Gmail label model
            
        Returns:
            GmailThread model or None if parsing fails
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
            
            # Get snippet from thread
            snippet = thread_data.get("snippet", "")
            
            # Create GmailThread record
            return GmailThread(
                gmail_account_id=gmail_account.id,
                workspace_id=gmail_account.workspace_id,
                thread_id=thread_data["id"],
                label_id=label.label_id,
                label_name=label.label_name,
                subject=subject[:500] if subject else None,  # Truncate long subjects
                snippet=snippet[:500] if snippet else None,
                from_email=from_email[:255] if from_email else None,
                from_name=from_name[:255] if from_name else None,
                to_emails=to_header,
                content=full_content,  # Text field can handle large content
                message_count=len(messages),  # Integer
                thread_date=thread_date,
                is_processed=False
            )
            
        except Exception as e:
            logger.error(f"Error parsing thread: {str(e)}")
            return None
    
    def _extract_message_body(self, message: Dict[str, Any]) -> str:
        """
        Extract the body text from a Gmail message
        
        Args:
            message: Gmail message data
            
        Returns:
            Extracted body text
        """
        try:
            payload = message.get("payload", {})
            
            # Try to get body directly
            body_data = payload.get("body", {}).get("data")
            if body_data:
                return base64.urlsafe_b64decode(body_data).decode("utf-8", errors="ignore")
            
            # Check for multipart message
            parts = payload.get("parts", [])
            for part in parts:
                mime_type = part.get("mimeType", "")
                
                # Prefer plain text
                if mime_type == "text/plain":
                    data = part.get("body", {}).get("data")
                    if data:
                        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                
                # Check nested parts
                nested_parts = part.get("parts", [])
                for nested in nested_parts:
                    if nested.get("mimeType") == "text/plain":
                        data = nested.get("body", {}).get("data")
                        if data:
                            return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            
            # Fallback to HTML and strip tags
            for part in parts:
                if part.get("mimeType") == "text/html":
                    data = part.get("body", {}).get("data")
                    if data:
                        html = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                        return self._strip_html_tags(html)
            
            # Use snippet as last resort
            return message.get("snippet", "")
            
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

"""
Gmail Sync Service - Handles syncing messages from Gmail
"""
import logging
import base64
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from email.utils import parsedate_to_datetime

from app.models.workspace_connector import WorkspaceConnector
from app.models.message import Message
from app.services.message_service import MessageService
from app.schemas.message import MessageCreate, SourceType

logger = logging.getLogger(__name__)


class GmailSyncService:
    """Service for syncing Gmail messages"""

    def __init__(self, db: Session):
        self.db = db
        self.message_service = MessageService(db)

    def get_gmail_service(self, connector: WorkspaceConnector):
        """Get Gmail API service with refreshed credentials"""
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from google.auth.transport.requests import Request

        if not connector.access_token:
            raise ValueError("Connector has no access token")

        creds = Credentials(
            token=connector.access_token,
            refresh_token=connector.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self._get_client_id(),
            client_secret=self._get_client_secret()
        )

        # Refresh token if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())

            # Update connector tokens
            from app.services.connector_service import ConnectorService
            connector_service = ConnectorService(self.db)
            connector_service.update_tokens(
                connector.id,
                access_token=creds.token,
                refresh_token=creds.refresh_token,
                expires_at=creds.expiry
            )

        return build('gmail', 'v1', credentials=creds)

    def _get_client_id(self) -> str:
        """Get Gmail OAuth client ID from config"""
        import os
        return os.getenv("GOOGLE_CLIENT_ID", "")

    def _get_client_secret(self) -> str:
        """Get Gmail OAuth client secret from config"""
        import os
        return os.getenv("GOOGLE_CLIENT_SECRET", "")

    def sync_messages(
        self,
        connector: WorkspaceConnector,
        full_sync: bool = False,
        label_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Sync messages from Gmail.

        Args:
            connector: The Gmail connector
            full_sync: Whether to do a full sync or incremental
            label_ids: Specific labels to sync (if None, syncs enabled labels)

        Returns:
            Dict with sync results
        """
        service = self.get_gmail_service(connector)

        # Get labels to sync
        if label_ids:
            labels = label_ids
        else:
            from app.services.connector_service import ConnectorService
            connector_service = ConnectorService(self.db)
            enabled_labels = connector_service.get_enabled_labels(connector.id)
            labels = [l.label_id for l in enabled_labels]

        if not labels:
            logger.warning(f"No labels configured for connector {connector.id}")
            return {"processed": 0, "new": 0, "updated": 0, "synced_ids": []}

        processed = 0
        new = 0
        updated = 0
        synced_ids = []

        for label_id in labels:
            try:
                result = self._sync_label(
                    service=service,
                    connector=connector,
                    label_id=label_id,
                    full_sync=full_sync
                )
                processed += result["processed"]
                new += result["new"]
                updated += result["updated"]
                synced_ids.extend(result["synced_ids"])

            except Exception as e:
                logger.exception(f"Error syncing label {label_id}: {e}")

        return {
            "processed": processed,
            "new": new,
            "updated": updated,
            "synced_ids": synced_ids
        }

    def _sync_label(
        self,
        service,
        connector: WorkspaceConnector,
        label_id: str,
        full_sync: bool = False
    ) -> Dict[str, Any]:
        """Sync messages from a single label"""
        processed = 0
        new = 0
        updated = 0
        synced_ids = []

        # Get label name
        try:
            label_info = service.users().labels().get(userId='me', id=label_id).execute()
            label_name = label_info.get("name", label_id)
        except Exception:
            label_name = label_id

        # Build query
        query = f"label:{label_id}"
        if not full_sync and connector.last_synced_at:
            # Use after: query for incremental sync
            date_str = connector.last_synced_at.strftime("%Y/%m/%d")
            query = f"label:{label_id} after:{date_str}"

        # Paginate through threads
        page_token = None
        while True:
            response = service.users().threads().list(
                userId='me',
                q=query,
                maxResults=100,
                pageToken=page_token
            ).execute()

            threads = response.get("threads", [])

            for thread_info in threads:
                try:
                    result = self._process_thread(
                        service=service,
                        connector=connector,
                        thread_id=thread_info["id"],
                        label_id=label_id,
                        label_name=label_name
                    )
                    processed += 1
                    if result["created"]:
                        new += 1
                        synced_ids.append(str(result["message_id"]))
                    elif result["updated"]:
                        updated += 1
                        synced_ids.append(str(result["message_id"]))

                except Exception as e:
                    logger.error(f"Error processing thread {thread_info['id']}: {e}")

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return {
            "processed": processed,
            "new": new,
            "updated": updated,
            "synced_ids": synced_ids
        }

    def _process_thread(
        self,
        service,
        connector: WorkspaceConnector,
        thread_id: str,
        label_id: str,
        label_name: str
    ) -> Dict[str, Any]:
        """Process a single Gmail thread"""
        # Get full thread data
        thread = service.users().threads().get(
            userId='me',
            id=thread_id,
            format='full'
        ).execute()

        messages = thread.get("messages", [])
        if not messages:
            return {"message_id": None, "created": False, "updated": False}

        # Extract thread metadata from first message
        first_msg = messages[0]
        headers = {h["name"].lower(): h["value"] for h in first_msg.get("payload", {}).get("headers", [])}

        subject = headers.get("subject", "(No Subject)")
        from_email = headers.get("from", "")
        to_emails = headers.get("to", "")

        # Parse sender name and email
        author_name = from_email
        author_email = from_email
        if "<" in from_email and ">" in from_email:
            author_name = from_email.split("<")[0].strip().strip('"')
            author_email = from_email.split("<")[1].split(">")[0]

        # Parse date
        sent_at = None
        date_str = headers.get("date")
        if date_str:
            try:
                sent_at = parsedate_to_datetime(date_str)
            except Exception:
                pass

        # Combine all message content
        content_parts = []
        for msg in messages:
            body = self._extract_body(msg)
            if body:
                content_parts.append(body)

        content = "\n\n---\n\n".join(content_parts) if content_parts else ""

        # Create message data
        message_data = MessageCreate(
            connector_id=connector.id,
            source=SourceType.GMAIL,
            external_id=thread_id,
            thread_id=thread_id,
            content=content,
            title=subject,
            label_name=label_name,
            author_name=author_name,
            author_email=author_email,
            from_email=author_email,
            to_emails=to_emails,
            message_count=len(messages),
            sent_at=sent_at,
            message_metadata={
                "label_ids": first_msg.get("labelIds", []),
                "snippet": thread.get("snippet", "")
            }
        )

        # Get or create message
        message, created = self.message_service.get_or_create_message(
            workspace_id=connector.workspace_id,
            connector_id=connector.id,
            external_id=thread_id,
            data=message_data
        )

        return {
            "message_id": message.id,
            "created": created,
            "updated": not created
        }

    def _extract_body(self, message: dict) -> str:
        """Extract body text from Gmail message"""
        payload = message.get("payload", {})

        # Check for simple body
        body = payload.get("body", {})
        if body.get("data"):
            return base64.urlsafe_b64decode(body["data"]).decode("utf-8", errors="ignore")

        # Check for multipart
        parts = payload.get("parts", [])
        for part in parts:
            if part.get("mimeType") == "text/plain":
                data = part.get("body", {}).get("data")
                if data:
                    return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")

            # Nested multipart
            nested_parts = part.get("parts", [])
            for nested in nested_parts:
                if nested.get("mimeType") == "text/plain":
                    data = nested.get("body", {}).get("data")
                    if data:
                        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")

        return ""

    def fetch_labels(self, connector: WorkspaceConnector) -> List[Dict[str, Any]]:
        """Fetch available labels from Gmail"""
        service = self.get_gmail_service(connector)

        response = service.users().labels().list(userId='me').execute()
        labels = []

        for label in response.get("labels", []):
            # Skip system labels we don't want
            if label["id"] in ["SPAM", "TRASH", "DRAFT", "SENT"]:
                continue

            # Get label details for message count
            try:
                details = service.users().labels().get(
                    userId='me',
                    id=label["id"]
                ).execute()

                labels.append({
                    "id": label["id"],
                    "name": label["name"],
                    "type": label.get("type", "user"),
                    "messages_total": details.get("messagesTotal", 0),
                    "messages_unread": details.get("messagesUnread", 0)
                })
            except Exception:
                labels.append({
                    "id": label["id"],
                    "name": label["name"],
                    "type": label.get("type", "user")
                })

        return labels

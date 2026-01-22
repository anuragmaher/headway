from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from app.core.config import settings
from app.models.workspace_connector import WorkspaceConnector
from sqlalchemy.orm import Session


def get_gmail_client(connector: WorkspaceConnector, db: Session):
    """
    Get Gmail client for making API requests.

    Args:
        connector: WorkspaceConnector with connector_type='gmail'
        db: Database session for persisting refreshed tokens

    Returns:
        Gmail API client
    """
    try:
        creds = Credentials(
            token=connector.access_token,
            refresh_token=connector.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=["https://www.googleapis.com/auth/gmail.readonly"]
        )

        # Refresh token if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())

            # Persist updated token
            connector.access_token = creds.token
            connector.token_expires_at = creds.expiry
            db.commit()

        return build("gmail", "v1", credentials=creds)
    except Exception as e:
        raise Exception(f"Error getting Gmail client: {e}")

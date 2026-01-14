from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from app.core.config import settings
from app.models.gmail import GmailAccounts
from sqlalchemy.orm import Session

def get_gmail_client(gmail_account: GmailAccounts, db: Session) -> Request:
    """
    Get Gmail client for making API requests
    """
    try:
        creds = Credentials(
            token=gmail_account.access_token,
            refresh_token=gmail_account.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=["https://www.googleapis.com/auth/gmail.readonly"]
        )

        # Refresh token if expired
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())

            # Persist updated token 
            gmail_account.access_token = creds.token
            gmail_account.token_expiry = creds.expiry
            db.commit()

        return build("gmail", "v1", credentials=creds)
    except Exception as e:
        raise Exception(f"Error getting Gmail client: {e}")


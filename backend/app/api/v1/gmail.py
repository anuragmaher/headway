from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from fastapi.concurrency import run_in_threadpool
import logging

from app.schemas.gmail_accounts import Gmail_account, SelectLabelsRequest
from app.core.deps import get_current_user, get_db
from app.services.gmail_oauth import gmailOauth
from app.services.gmail_client import get_gmail_client
from app.models.user import User
from app.models.gmail import GmailAccounts, GmailLabels
from googleapiclient.discovery import build 
logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# CONNECT GMAIL
# ============================================================

@router.get("/gmail/connect", response_model=Gmail_account)
async def connect_gmail_account(current_user=Depends(get_current_user)):
    """
    Generate OAuth URL for Gmail connection
    """
    try:
        flow = gmailOauth()
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            state=str(current_user.id)
        )

        return {"auth_url": auth_url}

    except Exception as e:
        logger.error(f"Error generating Gmail auth URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate Gmail OAuth")


# ============================================================
# OAUTH CALLBACK
# ============================================================

@router.get("/gmail/callback", response_model=Gmail_account)
async def gmail_callback(request: Request, db: Session = Depends(get_db)):
    """
    Callback endpoint for Gmail OAuth
    """
    try:
        code = request.query_params.get("code")
        state = request.query_params.get("state")

        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state")

        user_id = int(state)

        flow = gmailOauth()
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Run blocking Gmail API in threadpool
        def fetch_profile():
            gmail = build("gmail", "v1", credentials=credentials)
            return gmail.users().getProfile(userId="me").execute()

        profile = await run_in_threadpool(fetch_profile)
        gmail_email = profile["emailAddress"]

        # Map Gmail to correct logged-in user (NOT email match)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Prevent duplicate Gmail connections
        existing = db.query(GmailAccounts).filter(
            GmailAccounts.gmail_email == gmail_email
        ).first()

        if existing:
            return {
                "status": "already_connected",
                "gmail_email": gmail_email
            }

        gmail_account = GmailAccounts(
            user_id=user.id,
            gmail_email=gmail_email,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_expiry=credentials.expiry,
            created_at=datetime.now(timezone.utc)
        )

        db.add(gmail_account)
        db.commit()
        db.refresh(gmail_account)

        return {
            "status": "connected",
            "gmail_email": gmail_email,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error connecting Gmail account: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect Gmail")


# ============================================================
# FETCH LABELS
# ============================================================

@router.get("/gmail/labels")
async def fetch_labels(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        gmail_account = db.query(GmailAccounts).filter(
            GmailAccounts.user_id == current_user.id
        ).first()

        if not gmail_account:
            raise HTTPException(status_code=404, detail="Gmail account not found")

        def fetch():
            gmail = get_gmail_client(gmail_account, db)
            return gmail.users().labels().list(userId="me").execute()

        res = await run_in_threadpool(fetch)
        labels = res.get("labels", [])

        return {
            "labels": [
                {
                    "id": label["id"],
                    "name": label["name"],
                    "type": label["type"]
                }
                for label in labels
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Gmail labels: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch labels")


# ============================================================
# SAVE SELECTED LABELS
# ============================================================

@router.post("/gmail/labels/selected", response_model=GmailLabels)
def save_selected_labels(
    payload: SelectLabelsRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        gmail_account = db.query(GmailAccounts).filter(
            GmailAccounts.user_id == current_user.id
        ).first()

        if not gmail_account:
            raise HTTPException(status_code=404, detail="Gmail account not found")

        db.query(GmailLabels).filter(
            GmailLabels.gmail_account_id == gmail_account.id
        ).delete()

        labels_to_insert = [
            GmailLabels(
                gmail_account_id=gmail_account.id,
                label_id=label,
                label_name=label,
                watch_enabled=True,
                created_at=datetime.now(timezone.utc)
            )
            for label in payload.selected
        ]

        db.bulk_save_objects(labels_to_insert)
        db.commit()

        return {
            "labels": [
                {
                    "id": label.label_id,
                    "name": label.label_name
                }
                for label in labels_to_insert
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving Gmail labels: {e}")
        raise HTTPException(status_code=500, detail="Failed to save labels")

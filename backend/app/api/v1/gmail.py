from fastapi import APIRouter, Depends, Request, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from fastapi.concurrency import run_in_threadpool
import logging
from uuid import UUID
from app.core.config import settings
from fastapi.responses import RedirectResponse
from app.schemas.gmail_accounts import Gmail_account, SelectLabelsRequest, Gmail_labels, GmailAuthURLResponse
from app.core.deps import get_current_user, get_db
from app.core.database import SessionLocal
from app.services.gmail_oauth import gmailOauth
from app.services.gmail_client import get_gmail_client
from app.services.gmail_ingestion_service import gmail_ingestion_service
from app.models.user import User
from app.models.workspace import Workspace
from app.models.gmail import GmailAccounts, GmailLabels, GmailThread
from googleapiclient.discovery import build 

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================
# CONNECT GMAIL
# ============================================================

@router.get("/gmail/connect", response_model=GmailAuthURLResponse)
async def connect_gmail_account(current_user=Depends(get_current_user)):
    """
    Generate OAuth URL for Gmail connection
    """
    try:
        flow = gmailOauth()
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            state=str(current_user["id"])
        )

        return {"auth_url": auth_url}

    except Exception as e:
        logger.error(f"Error generating Gmail auth URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate Gmail OAuth")


# ============================================================
# OAUTH CALLBACK
# ============================================================
@router.get("/gmail/callback")
async def gmail_callback(request: Request, db: Session = Depends(get_db)):
    try:
        code = request.query_params.get("code")
        state = request.query_params.get("state")

        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state")

        user_id = UUID(state)

        flow = gmailOauth()
        flow.fetch_token(code=code)  
        credentials = flow.credentials

        if not credentials.refresh_token:
            raise Exception("Google did not return refresh_token")

        def fetch_profile():
            gmail = build("gmail", "v1", credentials=credentials)
            return gmail.users().getProfile(userId="me").execute()

        profile = await run_in_threadpool(fetch_profile)
        gmail_email = profile["emailAddress"]

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's workspace
        workspace = db.query(Workspace).filter(Workspace.owner_id == user_id).first()
        workspace_id = workspace.id if workspace else None

        existing = db.query(GmailAccounts).filter(
            GmailAccounts.gmail_email == gmail_email
        ).first()

        if existing:
            # Redirect to frontend callback page
            already_connected_redirect = (
                f"{settings.FRONTEND_URL}/gmail/callback?gmail=connected&existing=true"
            )
            return RedirectResponse(url=already_connected_redirect, status_code=302)

        gmail_account = GmailAccounts(
            user_id=user.id,
            workspace_id=workspace_id,
            gmail_email=gmail_email,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_expiry=credentials.expiry,
            created_at=datetime.now(timezone.utc),
        )

        db.add(gmail_account)
        db.commit()

        # Redirect to frontend callback page
        frontend_redirect = (
            f"{settings.FRONTEND_URL}/gmail/callback?gmail=connected"
        )
        return RedirectResponse(url=frontend_redirect, status_code=302)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Error connecting Gmail account")  # 👈 important
        raise HTTPException(status_code=500, detail=str(e))

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
            GmailAccounts.user_id == current_user["id"]
        ).first()

        if not gmail_account:
            raise HTTPException(status_code=404, detail="Gmail account not found")

        def fetch():
            gmail = get_gmail_client(gmail_account, db)
            return gmail.users().labels().list(userId="me").execute()

        res = await run_in_threadpool(fetch)
        labels = res.get("labels", [])
        print(labels)
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


# Background task function for Gmail ingestion
def run_gmail_ingestion_background(gmail_account_id: str):
    """Run Gmail ingestion in background with its own database session"""
    db = SessionLocal()
    try:
        logger.info(f"Starting background Gmail ingestion for account {gmail_account_id}")
        result = gmail_ingestion_service.ingest_threads_for_account(
            gmail_account_id=gmail_account_id,
            db=db,
            max_threads=5
        )
        logger.info(f"Background Gmail ingestion complete: {result}")
    except Exception as e:
        logger.error(f"Background Gmail ingestion failed: {e}")
    finally:
        db.close()


# ============================================================
# SAVE SELECTED LABELS
# ============================================================

@router.post("/gmail/labels/selected")
async def save_selected_labels(
    payload: SelectLabelsRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        gmail_account = db.query(GmailAccounts).filter(
            GmailAccounts.user_id == current_user["id"]
        ).first()

        if not gmail_account:
            raise HTTPException(status_code=404, detail="Gmail account not found")
        
        # Ensure workspace_id is set (in case account was created before this update)
        if not gmail_account.workspace_id:
            workspace = db.query(Workspace).filter(
                Workspace.owner_id == current_user["id"]
            ).first()
            if workspace:
                gmail_account.workspace_id = workspace.id

        db.query(GmailLabels).filter(
            GmailLabels.gmail_account_id == gmail_account.id
        ).delete()

        labels_to_insert = [
            GmailLabels(
                gmail_account_id=gmail_account.id,
                label_id=label.id,  # Gmail label ID (e.g., "Label_123")
                label_name=label.name,  # Gmail label name
                watch_enabled=True,
                created_at=datetime.now(timezone.utc)
            )
            for label in payload.selected
        ]

        db.bulk_save_objects(labels_to_insert)
        db.commit()
        
        gmail_account_id = str(gmail_account.id)
        
        # Trigger background ingestion if labels are selected
        if payload.selected and gmail_account.workspace_id:
            logger.info(f"Scheduling background Gmail ingestion for account {gmail_account_id}")
            background_tasks.add_task(run_gmail_ingestion_background, gmail_account_id)

        return {
            "labels": [
                {
                    "id": label.label_id,
                    "name": label.label_name
                }
                for label in labels_to_insert
            ],
            "ingestion_triggered": bool(payload.selected and gmail_account.workspace_id)
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving Gmail labels: {e}")
        raise HTTPException(status_code=500, detail="Failed to save labels")


# ============================================================
# GET SELECTED LABELS
# ============================================================

@router.get("/gmail/labels/selected")
async def get_selected_labels(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get selected labels for the current user's Gmail account
    """
    try:
        gmail_account = db.query(GmailAccounts).filter(
            GmailAccounts.user_id == current_user["id"]
        ).first()

        if not gmail_account:
            raise HTTPException(status_code=404, detail="Gmail account not found")

        selected_labels = db.query(GmailLabels).filter(
            GmailLabels.gmail_account_id == gmail_account.id
        ).all()

        return {
            "labels": [
                {
                    "id": label.label_id,
                    "name": label.label_name,
                    "type": "user"  # Assuming all selected labels are user labels
                }
                for label in selected_labels
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching selected Gmail labels: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch selected labels")


# ============================================================
# GET GMAIL ACCOUNTS
# ============================================================

@router.get("/gmail/accounts")
async def get_gmail_accounts(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all Gmail accounts for the current user
    """
    try:
        accounts = db.query(GmailAccounts).options(
            joinedload(GmailAccounts.user)
        ).filter(
            GmailAccounts.user_id == current_user["id"]
        ).all()

        return {
            "accounts": [
                {
                    "id": str(account.id),
                    "gmail_email": account.gmail_email,
                    "created_at": account.created_at.isoformat() if account.created_at else None,
                    "first_name": account.user.first_name if account.user else None,
                }
                for account in accounts
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching Gmail accounts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch Gmail accounts")


# ============================================================
# DISCONNECT GMAIL ACCOUNT
# ============================================================

@router.delete("/gmail/accounts/{account_id}")
async def disconnect_gmail_account(
    account_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnect a Gmail account
    """
    try:
        account = db.query(GmailAccounts).filter(
            GmailAccounts.id == UUID(account_id),
            GmailAccounts.user_id == current_user["id"]
        ).first()

        if not account:
            raise HTTPException(status_code=404, detail="Gmail account not found")

        # Delete associated labels first (cascade should handle this, but being explicit)
        db.query(GmailLabels).filter(
            GmailLabels.gmail_account_id == account.id
        ).delete()

        # Delete the account
        db.delete(account)
        db.commit()

        logger.info(f"Disconnected Gmail account {account_id} for user {current_user['id']}")

        return {"message": "Gmail account disconnected successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error disconnecting Gmail account {account_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect Gmail account")


# ============================================================
# SYNC GMAIL THREADS (Manual Trigger)
# ============================================================

@router.post("/gmail/sync")
async def sync_gmail_threads(
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger Gmail thread ingestion for the current user's account
    """
    try:
        gmail_account = db.query(GmailAccounts).filter(
            GmailAccounts.user_id == current_user["id"]
        ).first()

        if not gmail_account:
            raise HTTPException(status_code=404, detail="Gmail account not found")
        
        # Ensure workspace_id is set
        if not gmail_account.workspace_id:
            workspace = db.query(Workspace).filter(
                Workspace.owner_id == current_user["id"]
            ).first()
            if workspace:
                gmail_account.workspace_id = workspace.id
                db.commit()
        
        if not gmail_account.workspace_id:
            raise HTTPException(status_code=400, detail="No workspace associated with Gmail account")
        
        # Check if there are selected labels
        labels_count = db.query(GmailLabels).filter(
            GmailLabels.gmail_account_id == gmail_account.id,
            GmailLabels.watch_enabled == True
        ).count()
        
        if labels_count == 0:
            raise HTTPException(status_code=400, detail="No labels selected for syncing")
        
        gmail_account_id = str(gmail_account.id)
        
        # Trigger background ingestion
        logger.info(f"Manual sync triggered for Gmail account {gmail_account_id}")
        background_tasks.add_task(run_gmail_ingestion_background, gmail_account_id)

        return {
            "message": "Gmail sync started",
            "account_id": gmail_account_id,
            "labels_count": labels_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering Gmail sync: {e}")
        raise HTTPException(status_code=500, detail="Failed to trigger Gmail sync")


# ============================================================
# GET GMAIL THREADS (Fetched for AI Ingestion)
# ============================================================

@router.get("/gmail/threads")
async def get_gmail_threads(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """
    Get fetched Gmail threads for the current user's account
    """
    try:
        gmail_account = db.query(GmailAccounts).filter(
            GmailAccounts.user_id == current_user["id"]
        ).first()

        if not gmail_account:
            raise HTTPException(status_code=404, detail="Gmail account not found")

        # Get threads with pagination
        threads = db.query(GmailThread).filter(
            GmailThread.gmail_account_id == gmail_account.id
        ).order_by(
            GmailThread.thread_date.desc()
        ).offset(offset).limit(limit).all()
        
        total_count = db.query(GmailThread).filter(
            GmailThread.gmail_account_id == gmail_account.id
        ).count()

        return {
            "threads": [
                {
                    "id": str(thread.id),
                    "thread_id": thread.thread_id,
                    "subject": thread.subject,
                    "snippet": thread.snippet,
                    "from_email": thread.from_email,
                    "from_name": thread.from_name,
                    "to_emails": thread.to_emails,
                    "label_name": thread.label_name,
                    "message_count": thread.message_count,
                    "thread_date": thread.thread_date.isoformat() if thread.thread_date else None,
                    "is_processed": thread.is_processed,
                    "content_preview": thread.content[:500] if thread.content else None,
                    "created_at": thread.created_at.isoformat() if thread.created_at else None
                }
                for thread in threads
            ],
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "sync_status": gmail_account.sync_status,
            "last_synced_at": gmail_account.last_synced_at.isoformat() if gmail_account.last_synced_at else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Gmail threads: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch Gmail threads")
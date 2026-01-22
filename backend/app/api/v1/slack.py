from fastapi import APIRouter, Depends, HTTPException, Request, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import logging
from datetime import datetime
import hmac
import hashlib
import time
import os
import httpx

from app.core.database import get_db
from app.models.workspace_connector import WorkspaceConnector
from app.models.workspace import Workspace
from app.schemas.slack import (
    SlackTokensRequest,
    SlackChannelsResponse,
    SlackConnectionRequest,
    SlackConnectionResponse,
    SlackChannel
)
from app.services.slack_service import slack_service
from app.services.workspace_chat_service import get_workspace_chat_service
from app.core.deps import get_current_user_with_workspace

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/validate-tokens", response_model=SlackChannelsResponse)
async def validate_tokens_and_get_channels(
    request: SlackTokensRequest,
    current_user: dict = Depends(get_current_user_with_workspace),
    db: Session = Depends(get_db)
):
    """
    Validate Slack tokens and return available channels
    
    This endpoint validates both user and bot tokens, then fetches
    available channels for the user to select from.
    """
    try:
        # Validate user token with Slack API
        user_auth = await slack_service.validate_user_token(request.user_token)
        
        # Get channels using user token
        channels = await slack_service.get_channels(request.user_token)
        
        logger.info(f"User {current_user['id']} validated Slack tokens for team: {user_auth['team']}")
        
        return SlackChannelsResponse(
            channels=channels,
            team_id=user_auth["team_id"],
            team_name=user_auth["team"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating Slack tokens for user {current_user['id']}: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to validate tokens and fetch channels"
        )


@router.post("/connect", response_model=SlackConnectionResponse)
async def connect_slack_workspace(
    request: SlackConnectionRequest,
    current_user: dict = Depends(get_current_user_with_workspace),
    db: Session = Depends(get_db)
):
    """
    Connect a Slack workspace with selected channels
    
    This endpoint creates an integration record and stores the tokens
    and selected channels for ongoing message sync.
    """
    try:
        # Validate user token again (security measure)
        user_auth = await slack_service.validate_user_token(request.user_token)
        
        # Get full channel details for selected channels
        all_channels = await slack_service.get_channels(request.user_token)
        selected_channel_details = [
            channel for channel in all_channels 
            if channel.id in request.selected_channels
        ]
        
        if len(selected_channel_details) != len(request.selected_channels):
            raise HTTPException(
                status_code=400,
                detail="Some selected channels could not be found"
            )
        
        # Get user's workspace
        workspace = db.query(Workspace).filter(
            Workspace.id == current_user['workspace_id']
        ).first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # Check if Slack connector already exists for this workspace
        existing_connector = db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace.id,
            WorkspaceConnector.connector_type == "slack",
            WorkspaceConnector.external_id == user_auth["team_id"]
        ).first()

        if existing_connector:
            # Update existing connector
            existing_connector.is_active = True
            existing_connector.access_token = request.user_token
            existing_connector.config = {
                "selected_channels": [
                    {
                        "id": ch.id,
                        "name": ch.name,
                        "is_private": ch.is_private,
                        "member_count": ch.member_count
                    } for ch in selected_channel_details
                ],
                "user_id": user_auth["user_id"]
            }
            existing_connector.external_name = user_auth["team"]
            existing_connector.sync_status = "pending"
            existing_connector.updated_at = datetime.utcnow()

            connector = existing_connector
            logger.info(f"Updated existing Slack connector {connector.id}")

        else:
            # Create new connector
            connector = WorkspaceConnector(
                id=uuid.uuid4(),
                name=f"Slack - {user_auth['team']}",
                connector_type="slack",
                workspace_id=workspace.id,
                access_token=request.user_token,
                config={
                    "selected_channels": [
                        {
                            "id": ch.id,
                            "name": ch.name,
                            "is_private": ch.is_private,
                            "member_count": ch.member_count
                        } for ch in selected_channel_details
                    ],
                    "user_id": user_auth["user_id"]
                },
                external_id=user_auth["team_id"],
                external_name=user_auth["team"],
                sync_status="pending",
                is_active=True
            )

            db.add(connector)
            logger.info(f"Created new Slack connector {connector.id}")
        
        db.commit()
        db.refresh(connector)

        # TODO: Trigger background sync job here
        logger.info(f"Slack workspace connected for user {current_user['id']}: {user_auth['team']}")

        return SlackConnectionResponse(
            integration_id=str(connector.id),
            team_name=user_auth["team"],
            channels=selected_channel_details,
            status="connected"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error connecting Slack workspace for user {current_user['id']}: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to connect Slack workspace"
        )


@router.get("/integrations", response_model=List[dict])
async def get_slack_integrations(
    current_user: dict = Depends(get_current_user_with_workspace),
    db: Session = Depends(get_db)
):
    """
    Get all Slack integrations for the current user's workspace
    """
    try:
        workspace = db.query(Workspace).filter(
            Workspace.id == current_user['workspace_id']
        ).first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        connectors = db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace.id,
            WorkspaceConnector.connector_type == "slack",
            WorkspaceConnector.is_active == True
        ).all()

        result = []
        for connector in connectors:
            config = connector.config or {}
            channels = config.get("selected_channels", [])
            result.append({
                "id": str(connector.id),
                "name": connector.name,
                "team_name": connector.external_name,
                "team_id": connector.external_id,
                "status": "connected" if connector.is_active else "disconnected",
                "last_synced": connector.last_synced_at.isoformat() if connector.last_synced_at else None,
                "channels": channels,
                "created_at": connector.created_at.isoformat()
            })

        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Slack integrations for user {current_user['id']}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch Slack integrations"
        )


@router.delete("/integrations/{integration_id}")
async def disconnect_slack_integration(
    integration_id: str,
    current_user: dict = Depends(get_current_user_with_workspace),
    db: Session = Depends(get_db)
):
    """
    Disconnect a Slack integration
    """
    try:
        workspace = db.query(Workspace).filter(
            Workspace.id == current_user['workspace_id']
        ).first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        connector = db.query(WorkspaceConnector).filter(
            WorkspaceConnector.id == integration_id,
            WorkspaceConnector.workspace_id == workspace.id,
            WorkspaceConnector.connector_type == "slack"
        ).first()

        if not connector:
            raise HTTPException(status_code=404, detail="Integration not found")

        # Soft delete - mark as inactive
        connector.is_active = False
        connector.updated_at = datetime.utcnow()

        db.commit()

        logger.info(f"Disconnected Slack connector {integration_id} for user {current_user['id']}")
        
        return {"message": "Slack integration disconnected successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting Slack integration {integration_id} for user {current_user['id']}: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to disconnect Slack integration"
        )

# Helper function to verify Slack request signature
def verify_slack_signature(request_body: bytes, timestamp: str, signature: str) -> bool:
    """
    Verify that the request came from Slack by validating the signature
    """
    slack_signing_secret = os.getenv("SLACK_SIGNING_SECRET", "")
    if not slack_signing_secret:
        logger.error("SLACK_SIGNING_SECRET not configured")
        return False
    
    # Check timestamp to prevent replay attacks (within 5 minutes)
    try:
        request_timestamp = int(timestamp)
        if abs(time.time() - request_timestamp) > 60 * 5:
            logger.warning(f"Request timestamp too old: {timestamp}")
            return False
    except (ValueError, TypeError):
        logger.warning(f"Invalid timestamp: {timestamp}")
        return False
    
    # Compute expected signature
    sig_basestring = f"v0:{timestamp}:{request_body.decode('utf-8')}"
    expected_signature = 'v0=' + hmac.new(
        slack_signing_secret.encode(),
        sig_basestring.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Compare signatures
    return hmac.compare_digest(expected_signature, signature)


# Background task to send delayed response
async def send_slack_response(response_url: str, text: str = None, blocks: list = None):
    """
    Send a delayed response to Slack using response_url
    Supports both plain text and Block Kit format
    """
    try:
        payload = {
            "response_type": "ephemeral",  # Only visible to command user
        }

        if blocks:
            payload["blocks"] = blocks
            # Add fallback text for notifications
            if text:
                payload["text"] = text
            else:
                payload["text"] = "Response from HeadwayHQ"
        else:
            payload["text"] = text

        async with httpx.AsyncClient() as client:
            await client.post(
                response_url,
                json=payload,
                timeout=30.0
            )
            logger.info(f"Sent delayed response to Slack")
    except Exception as e:
        logger.error(f"Error sending delayed Slack response: {e}")


@router.post("/command")
async def handle_slash_command(
    background_tasks: BackgroundTasks,
    team_id: str = Form(...),
    user_id: str = Form(...),
    user_name: str = Form(...),
    text: str = Form(...),
    response_url: str = Form(...)
):
    """
    Handle Slack slash command: /headway <query>

    This endpoint processes natural language queries from Slack and returns
    customer insights using the workspace chat service.

    CRITICAL: This endpoint MUST respond within 3 seconds to avoid Slack timeout.
    All processing happens in background task after immediate acknowledgment.

    Example: /headway Which customers are in Healthcare?
    """
    # Schedule background task IMMEDIATELY (do logging there, not here)
    # Background task creates its own DB session
    background_tasks.add_task(
        process_and_respond,
        team_id=team_id,
        user_query=text.strip() if text else "",
        response_url=response_url,
        user_name=user_name,
        user_id=user_id
    )

    # Return immediate acknowledgment (within milliseconds)
    return {
        "response_type": "ephemeral",
        "text": "⏳ Processing your question..."
    }


def convert_markdown_to_slack_mrkdwn(text: str) -> str:
    """
    Convert standard markdown to Slack's mrkdwn format
    - **bold** becomes *bold*
    - ### Headings become *bold text* with newlines
    - Remove extra formatting that doesn't render well
    """
    import re

    # Convert ### headings to bold text with extra newlines for emphasis
    text = re.sub(r'###\s+([^\n]+)', r'\n*\1*', text)

    # Convert ## headings to bold text
    text = re.sub(r'##\s+([^\n]+)', r'\n*\1*', text)

    # Convert # headings to bold text
    text = re.sub(r'#\s+([^\n]+)', r'\n*\1*', text)

    # Convert **bold** to *bold* (Slack uses single asterisks)
    text = re.sub(r'\*\*([^*]+)\*\*', r'*\1*', text)

    return text


async def process_and_respond(
    team_id: str,
    user_query: str,
    response_url: str,
    user_name: str,
    user_id: str
):
    """
    Background task to process query and send response to Slack
    Handles all validation and processing after immediate acknowledgment
    Creates its own database session to avoid lifecycle issues
    """
    # Log the command here in background task (not in main endpoint for speed)
    logger.info(f"Slash command received from {user_name} ({user_id}) in team {team_id}: {user_query}")

    # Create a fresh database session for this background task
    db = next(get_db())

    try:
        # Step 1: Look up workspace by slack_team_id
        workspace = db.query(Workspace).filter(
            Workspace.slack_team_id == team_id
        ).first()

        if not workspace:
            logger.warning(f"Workspace not found for Slack team {team_id}")
            error_blocks = [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"⚠️ *HeadwayHQ is not connected to this Slack workspace*\n\nPlease connect at: {os.getenv('FRONTEND_URL', 'https://app.headwayhq.com')}/settings"
                    }
                }
            ]
            await send_slack_response(response_url, text="Not connected", blocks=error_blocks)
            return

        # Step 2: Validate query text
        if not user_query or user_query.strip() == "":
            help_blocks = [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "ℹ️ *How to use /headway*\n\nAsk natural language questions about your customers:\n\n"
                                "• `/headway Which customers are in Healthcare?`\n"
                                "• `/headway Show me customers with most messages`\n"
                                "• `/headway What are the top feature requests?`\n"
                                "• `/headway List customers by industry`"
                    }
                }
            ]
            await send_slack_response(response_url, text="Help", blocks=help_blocks)
            return

        # Step 3: Get workspace chat service and process query
        chat_service = get_workspace_chat_service()

        result = chat_service.chat(
            db=db,
            workspace_id=str(workspace.id),
            user_query=user_query
        )

        # Step 4: Format response for Slack using Block Kit
        if result.get("success"):
            # Convert markdown to Slack's mrkdwn format
            slack_formatted_response = convert_markdown_to_slack_mrkdwn(result['response'])

            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"💬 {user_query}",
                        "emoji": True
                    }
                },
                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": slack_formatted_response
                    }
                }
            ]

            # Add SQL query info if available (for debugging)
            if result.get("sql_query"):
                blocks.append({
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": "_Query method: SQL_"
                        }
                    ]
                })

            # Send formatted response with blocks
            await send_slack_response(
                response_url,
                text=f"Response to: {user_query}",  # Fallback text
                blocks=blocks
            )

            logger.info(f"Successfully processed Slack command for workspace {workspace.id}")
        else:
            # Error response with simple block
            error_blocks = [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"❌ {result.get('response', 'Unable to process your question. Please try rephrasing.')}"
                    }
                }
            ]
            await send_slack_response(
                response_url,
                text="Error processing your question",
                blocks=error_blocks
            )

    except Exception as e:
        logger.error(f"Error processing Slack command in background: {e}")
        import traceback
        traceback.print_exc()

        # Send error response
        error_blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"❌ Sorry, I encountered an error: {str(e)}\n\nPlease try rephrasing your question or contact support."
                }
            }
        ]
        await send_slack_response(
            response_url,
            text="Error occurred",
            blocks=error_blocks
        )
    finally:
        # Always close the database session
        db.close()

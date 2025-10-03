from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
import logging
from datetime import datetime

from app.core.database import get_db
from app.models.integration import Integration
from app.models.workspace import Workspace
from app.schemas.slack import (
    SlackTokensRequest,
    SlackChannelsResponse,
    SlackConnectionRequest,
    SlackConnectionResponse,
    SlackChannel
)
from app.services.slack_service import slack_service
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
        
        # Check if Slack integration already exists for this workspace
        existing_integration = db.query(Integration).filter(
            Integration.workspace_id == workspace.id,
            Integration.provider == "slack",
            Integration.external_team_id == user_auth["team_id"]
        ).first()
        
        if existing_integration:
            # Update existing integration
            existing_integration.is_active = True
            existing_integration.access_token = request.user_token
            existing_integration.provider_metadata = {
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
            existing_integration.external_user_id = user_auth["user_id"]
            existing_integration.external_team_name = user_auth["team"]
            existing_integration.sync_status = "pending"
            existing_integration.updated_at = datetime.utcnow()
            
            integration = existing_integration
            logger.info(f"Updated existing Slack integration {integration.id}")
            
        else:
            # Create new integration
            integration = Integration(
                id=uuid.uuid4(),
                name=f"Slack - {user_auth['team']}",
                provider="slack",
                workspace_id=workspace.id,
                access_token=request.user_token,
                provider_metadata={
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
                external_user_id=user_auth["user_id"],
                external_team_id=user_auth["team_id"],
                external_team_name=user_auth["team"],
                sync_status="pending",
                is_active=True
            )
            
            db.add(integration)
            logger.info(f"Created new Slack integration {integration.id}")
        
        db.commit()
        db.refresh(integration)
        
        # TODO: Trigger background sync job here
        logger.info(f"Slack workspace connected for user {current_user['id']}: {user_auth['team']}")
        
        return SlackConnectionResponse(
            integration_id=str(integration.id),
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
        
        integrations = db.query(Integration).filter(
            Integration.workspace_id == workspace.id,
            Integration.provider == "slack",
            Integration.is_active == True
        ).all()
        
        result = []
        for integration in integrations:
            channels = integration.provider_metadata.get("selected_channels", [])
            result.append({
                "id": str(integration.id),
                "name": integration.name,
                "team_name": integration.external_team_name,
                "team_id": integration.external_team_id,
                "status": "connected" if integration.is_active else "disconnected",
                "last_synced": integration.last_synced_at.isoformat() if integration.last_synced_at else None,
                "channels": channels,
                "created_at": integration.created_at.isoformat()
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
        
        integration = db.query(Integration).filter(
            Integration.id == integration_id,
            Integration.workspace_id == workspace.id,
            Integration.provider == "slack"
        ).first()
        
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")
        
        # Soft delete - mark as inactive
        integration.is_active = False
        integration.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Disconnected Slack integration {integration_id} for user {current_user['id']}")
        
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
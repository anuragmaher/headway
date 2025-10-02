from fastapi import APIRouter
from app.schemas.slack import (
    SlackTokensRequest,
    SlackChannelsResponse,
    SlackConnectionRequest,
    SlackConnectionResponse,
)
from app.services.slack_service import slack_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/validate-tokens", response_model=SlackChannelsResponse)
async def validate_tokens_and_get_channels(request: SlackTokensRequest):
    """
    Test endpoint to validate Slack tokens and return available channels
    WITHOUT authentication for now
    """
    try:
        # Validate tokens with Slack API
        user_auth, bot_auth = await slack_service.validate_tokens(
            request.user_token, 
            request.bot_token
        )
        
        # Get channels using user token
        channels = await slack_service.get_channels(request.user_token)
        
        logger.info(f"Validated Slack tokens for team: {user_auth['team']}")
        
        return SlackChannelsResponse(
            channels=channels,
            team_id=user_auth["team_id"],
            team_name=user_auth["team"]
        )
        
    except Exception as e:
        logger.error(f"Error validating Slack tokens: {e}")
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500, 
            detail=str(e)
        )


@router.post("/connect", response_model=SlackConnectionResponse)
async def connect_slack_workspace(request: SlackConnectionRequest):
    """
    Test endpoint to simulate connecting Slack workspace
    WITHOUT authentication or database for now
    """
    try:
        # Validate tokens again
        user_auth, bot_auth = await slack_service.validate_tokens(
            request.user_token, 
            request.bot_token
        )
        
        # Get selected channel details
        all_channels = await slack_service.get_channels(request.user_token)
        selected_channel_details = [
            channel for channel in all_channels 
            if channel.id in request.selected_channels
        ]
        
        if len(selected_channel_details) != len(request.selected_channels):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail="Some selected channels could not be found"
            )
        
        logger.info(f"Test connection successful for team: {user_auth['team']} with {len(selected_channel_details)} channels")
        
        return SlackConnectionResponse(
            integration_id="test-integration-123",
            team_name=user_auth["team"],
            channels=selected_channel_details,
            status="connected"
        )
        
    except Exception as e:
        logger.error(f"Error connecting Slack workspace: {e}")
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/integrations")
async def get_slack_integrations():
    """
    Test endpoint to return empty integrations list
    WITHOUT authentication or database for now
    """
    return []
import httpx
import json
from typing import List, Dict, Any, Tuple, Optional
from fastapi import HTTPException
import logging

from app.schemas.slack import SlackChannel, SlackAuthTestResponse, SlackConversationsListResponse

logger = logging.getLogger(__name__)


class SlackService:
    """Service for interacting with Slack APIs"""
    
    SLACK_BASE_URL = "https://slack.com/api"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def validate_user_token(self, user_token: str) -> Dict[str, Any]:
        """
        Validate user token by calling Slack's auth.test endpoint
        
        Returns:
            User auth response dict
        """
        try:
            # Validate user token
            user_response = await self._call_slack_api("auth.test", user_token)
            logger.info(f"User token validation response: {user_response}")
            if not user_response.get("ok"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid user token: {user_response.get('error', 'Unknown error')}"
                )
            
            logger.info(f"Successfully validated user token for team: {user_response.get('team')}")
            return user_response
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error validating Slack tokens: {e}")
            raise HTTPException(status_code=500, detail="Failed to connect to Slack API")
        except Exception as e:
            logger.error(f"Error validating Slack tokens: {e}")
            raise HTTPException(status_code=500, detail="Failed to validate Slack tokens")
    
    async def get_channels(self, user_token: str, include_private: bool = True) -> List[SlackChannel]:
        """
        Fetch channels from Slack workspace using user token
        
        Args:
            user_token: Slack user OAuth token
            include_private: Whether to include private channels
            
        Returns:
            List of SlackChannel objects
        """
        try:
            # Get public channels
            public_channels = await self._get_conversations(
                user_token, 
                types="public_channel",
                exclude_archived=True
            )
            
            channels = []
            
            # Process public channels
            for channel in public_channels:
                if channel.get("is_channel") and not channel.get("is_archived"):
                    slack_channel = SlackChannel(
                        id=channel["id"],
                        name=channel["name"],
                        is_private=False,
                        member_count=channel.get("num_members"),
                        purpose=channel.get("purpose", {}).get("value"),
                        topic=channel.get("topic", {}).get("value")
                    )
                    channels.append(slack_channel)
            
            # Get private channels if requested
            if include_private:
                try:
                    private_channels = await self._get_conversations(
                        user_token,
                        types="private_channel", 
                        exclude_archived=True
                    )
                    
                    for channel in private_channels:
                        if channel.get("is_group") and not channel.get("is_archived"):
                            slack_channel = SlackChannel(
                                id=channel["id"],
                                name=channel["name"],
                                is_private=True,
                                member_count=channel.get("num_members"),
                                purpose=channel.get("purpose", {}).get("value"),
                                topic=channel.get("topic", {}).get("value")
                            )
                            channels.append(slack_channel)
                            
                except Exception as e:
                    logger.warning(f"Failed to fetch private channels: {e}")
                    # Continue without private channels - user might not have permission
            
            # Sort channels by name
            channels.sort(key=lambda x: x.name.lower())
            
            logger.info(f"Fetched {len(channels)} channels from Slack")
            return channels
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching Slack channels: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch Slack channels")
    
    async def _get_conversations(self, token: str, types: str, exclude_archived: bool = True) -> List[Dict[str, Any]]:
        """
        Helper method to get conversations from Slack API with pagination
        """
        all_channels = []
        cursor = None
        
        while True:
            params = {
                "types": types,
                "exclude_archived": exclude_archived,
                "limit": 200  # Max limit per Slack API
            }
            
            if cursor:
                params["cursor"] = cursor
            
            response = await self._call_slack_api("conversations.list", token, params=params)
            
            if not response.get("ok"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch conversations: {response.get('error', 'Unknown error')}"
                )
            
            channels = response.get("channels", [])
            all_channels.extend(channels)
            
            # Check if there are more pages
            response_metadata = response.get("response_metadata", {})
            cursor = response_metadata.get("next_cursor")
            
            if not cursor:
                break
        
        return all_channels
    
    async def _call_slack_api(self, endpoint: str, token: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make authenticated request to Slack API
        
        Args:
            endpoint: Slack API endpoint (e.g., 'auth.test')
            token: Slack OAuth token
            params: Optional query parameters
            
        Returns:
            JSON response from Slack API
        """
        url = f"{self.SLACK_BASE_URL}/{endpoint}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        # Use GET for most endpoints, POST for some
        if endpoint in ["auth.test", "conversations.list", "conversations.history", "users.info"]:
            response = await self.client.get(url, headers=headers, params=params or {})
        else:
            # For POST endpoints, use JSON for chat.postMessage, form data for others
            if endpoint == "chat.postMessage":
                headers["Content-Type"] = "application/json"
                response = await self.client.post(url, headers=headers, json=params or {})
            else:
                response = await self.client.post(url, headers=headers, data=params or {})
        
        response.raise_for_status()
        return response.json()
    
    async def get_channel_messages(self, token: str, channel_id: str, limit: int = 100, oldest: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch messages from a specific Slack channel
        
        Args:
            token: Slack user OAuth token
            channel_id: Channel ID to fetch messages from
            limit: Number of messages to fetch (max 1000)
            oldest: Timestamp to fetch messages from (format: '1234567890.123456')
            
        Returns:
            List of message objects
        """
        try:
            params = {
                "channel": channel_id,
                "limit": min(limit, 1000)  # Slack API limit
            }
            
            if oldest:
                params["oldest"] = oldest
                
            response = await self._call_slack_api("conversations.history", token, params=params)
            
            if not response.get("ok"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch messages: {response.get('error', 'Unknown error')}"
                )
            
            messages = response.get("messages", [])
            logger.info(f"Fetched {len(messages)} messages from channel {channel_id}")
            return messages
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching messages from channel {channel_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch channel messages")
    
    async def get_user_info(self, token: str, user_id: str) -> Dict[str, Any]:
        """
        Get user information from Slack
        
        Args:
            token: Slack user OAuth token
            user_id: Slack user ID
            
        Returns:
            User information dict
        """
        try:
            params = {"user": user_id}
            response = await self._call_slack_api("users.info", token, params=params)
            
            if not response.get("ok"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch user info: {response.get('error', 'Unknown error')}"
                )
            
            return response.get("user", {})
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching user info for {user_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch user info")

    async def post_message(
        self,
        token: str,
        channel_id: str,
        text: Optional[str] = None,
        blocks: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Post a message to a Slack channel using chat.postMessage API
        
        Args:
            token: Slack OAuth token (bot token or user token)
            channel_id: Slack channel ID to post to
            text: Plain text message (fallback if blocks are provided)
            blocks: Optional Block Kit blocks for rich formatting
            
        Returns:
            Response from Slack API
        """
        try:
            params = {
                "channel": channel_id,
            }
            
            if blocks:
                # For chat.postMessage, blocks should be passed as JSON array, not stringified
                params["blocks"] = blocks
                # Text is required as fallback when using blocks
                params["text"] = text or "Notification from HeadwayHQ"
            elif text:
                params["text"] = text
            else:
                raise ValueError("Either text or blocks must be provided")
            
            response = await self._call_slack_api("chat.postMessage", token, params=params)
            
            if not response.get("ok"):
                error = response.get("error", "Unknown error")
                logger.error(f"Failed to post message to Slack channel {channel_id}: {error}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to post message to Slack: {error}"
                )
            
            logger.info(f"Successfully posted message to Slack channel {channel_id}")
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error posting message to Slack channel {channel_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to post message to Slack")

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Global service instance
slack_service = SlackService()
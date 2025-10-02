import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.models.integration import Integration
from app.models.message import Message
from app.services.slack_service import slack_service

logger = logging.getLogger(__name__)


class MessageIngestionService:
    """Service for ingesting messages from various integrations"""
    
    def __init__(self):
        self.user_cache: Dict[str, Dict[str, Any]] = {}  # Cache user info to avoid repeated API calls
    
    async def ingest_slack_messages(self, integration_id: str, db: Session, hours_back: int = 24) -> int:
        """
        Ingest messages from a Slack integration
        
        Args:
            integration_id: Integration ID to ingest messages for
            db: Database session
            hours_back: How many hours back to fetch messages (default: 24)
            
        Returns:
            Number of messages ingested
        """
        try:
            # Get the integration
            integration = db.query(Integration).filter(
                and_(
                    Integration.id == integration_id,
                    Integration.provider == "slack",
                    Integration.is_active == True
                )
            ).first()
            
            if not integration:
                logger.error(f"Integration {integration_id} not found or not active")
                return 0
            
            if not integration.access_token:
                logger.error(f"No access token for integration {integration_id}")
                return 0
            
            # Get selected channels from metadata
            selected_channels = integration.provider_metadata.get("selected_channels", [])
            if not selected_channels:
                logger.warning(f"No channels selected for integration {integration_id}")
                return 0
            
            # Calculate oldest timestamp (24 hours ago by default)
            oldest_time = datetime.utcnow() - timedelta(hours=hours_back)
            oldest_timestamp = str(oldest_time.timestamp())
            
            total_ingested = 0
            
            # Process each selected channel
            for channel_info in selected_channels:
                channel_id = channel_info["id"]
                channel_name = channel_info["name"]
                
                logger.info(f"Ingesting messages from channel #{channel_name} ({channel_id})")
                
                try:
                    # Fetch messages from Slack (without timestamp filter for now)
                    messages = await slack_service.get_channel_messages(
                        token=integration.access_token,
                        channel_id=channel_id,
                        limit=100  # Start with recent 100 messages
                        # oldest=oldest_timestamp  # Commented out due to system clock issue
                    )
                    
                    # Process and store messages
                    channel_ingested = await self._process_slack_messages(
                        messages=messages,
                        integration=integration,
                        channel_id=channel_id,
                        channel_name=channel_name,
                        db=db
                    )
                    
                    total_ingested += channel_ingested
                    logger.info(f"Ingested {channel_ingested} messages from #{channel_name}")
                    
                except Exception as e:
                    logger.error(f"Error ingesting messages from channel #{channel_name}: {e}")
                    continue
            
            # Update integration sync status
            integration.last_synced_at = datetime.utcnow()
            integration.sync_status = "success"
            integration.sync_error = None
            db.commit()
            
            logger.info(f"Total messages ingested for integration {integration_id}: {total_ingested}")
            return total_ingested
            
        except Exception as e:
            logger.error(f"Error in ingest_slack_messages for integration {integration_id}: {e}")
            # Update integration with error status
            if 'integration' in locals():
                integration.sync_status = "error"
                integration.sync_error = str(e)
                db.commit()
            return 0
    
    async def _process_slack_messages(
        self, 
        messages: List[Dict[str, Any]], 
        integration: Integration,
        channel_id: str,
        channel_name: str,
        db: Session
    ) -> int:
        """
        Process and store Slack messages in database
        
        Args:
            messages: List of Slack message objects
            integration: Integration instance
            channel_id: Slack channel ID
            channel_name: Slack channel name
            db: Database session
            
        Returns:
            Number of messages processed
        """
        processed_count = 0
        
        for message_data in messages:
            try:
                # Get external ID first
                external_id = message_data.get("ts")  # Slack timestamp as unique ID
                
                # Skip certain message types
                if self._should_skip_message(message_data):
                    logger.debug(f"Skipping message {external_id}: {self._get_skip_reason(message_data)}")
                    continue
                
                # Check if message already exists
                existing_message = db.query(Message).filter(
                    and_(
                        Message.external_id == external_id,
                        Message.integration_id == integration.id,
                        Message.channel_id == channel_id
                    )
                ).first()
                
                if existing_message:
                    continue  # Skip if already exists
                
                # Get author information
                author_info = await self._get_author_info(
                    user_id=message_data.get("user"),
                    token=integration.access_token
                )
                
                # Create message object
                message = Message(
                    external_id=external_id,
                    content=message_data.get("text", ""),
                    source="slack",
                    channel_name=channel_name,
                    channel_id=channel_id,
                    author_name=author_info.get("name"),
                    author_id=message_data.get("user"),
                    author_email=author_info.get("email"),
                    message_metadata={
                        "reactions": message_data.get("reactions", []),
                        "thread_ts": message_data.get("thread_ts"),
                        "reply_count": message_data.get("reply_count", 0),
                        "raw_message": message_data
                    },
                    thread_id=message_data.get("thread_ts"),
                    is_thread_reply=bool(message_data.get("thread_ts") and message_data.get("thread_ts") != external_id),
                    workspace_id=integration.workspace_id,
                    integration_id=integration.id,
                    sent_at=datetime.fromtimestamp(float(external_id))
                )
                
                db.add(message)
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Error processing message {message_data.get('ts', 'unknown')}: {e}")
                continue
        
        # Commit all messages for this channel
        try:
            db.commit()
            logger.info(f"Committed {processed_count} messages from #{channel_name}")
        except Exception as e:
            logger.error(f"Error committing messages for #{channel_name}: {e}")
            db.rollback()
            processed_count = 0
        
        return processed_count
    
    def _should_skip_message(self, message_data: Dict[str, Any]) -> bool:
        """
        Determine if a message should be skipped during ingestion
        
        Args:
            message_data: Slack message object
            
        Returns:
            True if message should be skipped
        """
        # Only skip very specific system messages that add no value
        subtype = message_data.get("subtype")
        if subtype in [
            "channel_join", "channel_leave", "channel_archive", "channel_unarchive",
            "channel_name", "channel_topic", "channel_purpose", "group_join", "group_leave"
        ]:
            return True
        
        # Skip empty messages (no text content)
        if not message_data.get("text", "").strip():
            return True
        
        # Skip obvious spam/noise apps (be very selective here)
        app_id = message_data.get("app_id")
        if app_id:
            # Only skip apps that are definitely noise (like GIFs)
            noise_apps = ["A0F7XDUAZ"]  # Giphy
            if app_id in noise_apps:
                return True
        
        # NOTE: We now include bot messages! They could contain feature requests
        # NOTE: We include app messages! They could be feature request forms/tools
        
        return False
    
    def _get_skip_reason(self, message_data: Dict[str, Any]) -> str:
        """Get reason why message was skipped (for debugging)"""
        subtype = message_data.get("subtype")
        if subtype in [
            "channel_join", "channel_leave", "channel_archive", "channel_unarchive",
            "channel_name", "channel_topic", "channel_purpose", "group_join", "group_leave"
        ]:
            return f"system message: {subtype}"
        
        if not message_data.get("text", "").strip():
            return "empty text"
        
        app_id = message_data.get("app_id")
        if app_id:
            noise_apps = ["A0F7XDUAZ"]  # Giphy
            if app_id in noise_apps:
                return f"noise app: {app_id}"
        
        return "unknown reason"
    
    async def _get_author_info(self, user_id: Optional[str], token: str) -> Dict[str, Any]:
        """
        Get author information from Slack API with caching
        
        Args:
            user_id: Slack user ID
            token: Slack access token
            
        Returns:
            User information dict
        """
        if not user_id:
            return {"name": "Unknown User", "email": None}
        
        # Check cache first
        if user_id in self.user_cache:
            return self.user_cache[user_id]
        
        try:
            user_info = await slack_service.get_user_info(token, user_id)
            
            # Extract relevant information
            profile = user_info.get("profile", {})
            author_info = {
                "name": profile.get("display_name") or profile.get("real_name") or user_info.get("name", "Unknown User"),
                "email": profile.get("email")
            }
            
            # Cache the result
            self.user_cache[user_id] = author_info
            return author_info
            
        except Exception as e:
            logger.warning(f"Failed to fetch user info for {user_id}: {e}")
            return {"name": "Unknown User", "email": None}


# Global service instance
message_ingestion_service = MessageIngestionService()
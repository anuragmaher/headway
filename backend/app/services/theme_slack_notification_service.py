"""
Theme-specific Slack notification service for transcript insights

Sends Slack notifications to theme-connected channels when transcript
insights are classified and mapped to themes.
"""

import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.theme import Theme
from app.models.workspace_connector import WorkspaceConnector
from app.models.transcript_classification import TranscriptClassification
from app.services.slack_service import slack_service

logger = logging.getLogger(__name__)


class ThemeSlackNotificationService:
    """Service for sending theme-specific Slack notifications for transcript insights"""

    @staticmethod
    async def send_transcript_insight_notification(
        db: Session,
        theme_id: UUID,
        classification: TranscriptClassification
    ) -> bool:
        """
        Send Slack notification to theme's connected channel when transcript insights are extracted.

        Args:
            db: Database session
            theme_id: Theme ID to send notification for
            classification: The TranscriptClassification containing extracted insights

        Returns:
            True if notification was sent successfully, False otherwise
        """
        try:
            # Fetch theme with Slack integration
            theme = db.query(Theme).filter(Theme.id == theme_id).first()
            if not theme:
                logger.warning(f"Theme {theme_id} not found")
                return False

            # Check if theme has Slack channel connected
            if not theme.slack_integration_id or not theme.slack_channel_id:
                logger.debug(f"Theme {theme_id} has no Slack channel connected - skipping notification")
                return False

            # Get the workspace connector for the Slack token
            connector = db.query(WorkspaceConnector).filter(
                WorkspaceConnector.id == theme.slack_integration_id,
                WorkspaceConnector.is_active == True
            ).first()

            if not connector or not connector.access_token:
                logger.warning(f"No active Slack connector found for theme {theme_id}")
                return False

            # Build the notification message
            blocks = ThemeSlackNotificationService._build_transcript_insight_blocks(
                theme=theme,
                classification=classification
            )

            # Send the notification
            fallback_text = f"New transcript insight for theme: {theme.name}"

            await slack_service.post_message(
                token=connector.access_token,
                channel_id=theme.slack_channel_id,
                text=fallback_text,
                blocks=blocks
            )

            logger.info(f"Sent transcript insight notification to channel {theme.slack_channel_name} for theme {theme.name}")
            return True

        except Exception as e:
            logger.error(f"Error sending transcript insight notification for theme {theme_id}: {e}")
            return False

    @staticmethod
    def _build_transcript_insight_blocks(
        theme: Theme,
        classification: TranscriptClassification
    ) -> List[Dict[str, Any]]:
        """
        Build Slack Block Kit blocks for transcript insight notification.

        Args:
            theme: The theme this notification is for
            classification: The transcript classification with extracted data

        Returns:
            List of Block Kit blocks
        """
        extracted_data = classification.extracted_data or {}

        # Log the extracted_data keys for debugging
        logger.info(f"Building notification blocks. extracted_data keys: {list(extracted_data.keys())}")

        # Extract data matching actual AI response structure
        # AI returns: transcript_metadata, mappings, unmapped_signals, theme_summary
        transcript_metadata = extracted_data.get('transcript_metadata', {})
        mappings = extracted_data.get('mappings', []) or []
        theme_summary = extracted_data.get('theme_summary', {})
        unmapped_signals = extracted_data.get('unmapped_signals', [])

        # Also check legacy field names for backwards compatibility
        call_metadata = extracted_data.get('call_metadata', {}) or transcript_metadata
        customer_metadata = extracted_data.get('customer_metadata', {})
        key_insights = extracted_data.get('key_insights', {})
        risk_assessment = extracted_data.get('risk_assessment', {})

        # Extract insights from mappings by signal_type
        pain_points_from_mappings = []
        feature_requests_from_mappings = []
        competitive_from_mappings = []
        feedback_from_mappings = []

        for mapping in mappings:
            signal_type = mapping.get('signal_type', '').lower()
            interpreted_need = mapping.get('interpreted_need', '')
            verbatim_quote = mapping.get('verbatim_quote', '')

            if signal_type == 'pain_point' and interpreted_need:
                pain_points_from_mappings.append({
                    'need': interpreted_need,
                    'quote': verbatim_quote,
                    'confidence': mapping.get('confidence_score'),
                    'impact': mapping.get('impact_score')
                })
            elif signal_type == 'feature_request' and interpreted_need:
                feature_requests_from_mappings.append({
                    'need': interpreted_need,
                    'quote': verbatim_quote,
                    'confidence': mapping.get('confidence_score'),
                    'impact': mapping.get('impact_score'),
                    'reasoning': mapping.get('reasoning', '')
                })
            elif signal_type == 'competitive_mention' and (interpreted_need or verbatim_quote):
                competitive_from_mappings.append({
                    'need': interpreted_need,
                    'quote': verbatim_quote
                })
            elif signal_type == 'feedback' and interpreted_need:
                feedback_from_mappings.append({
                    'need': interpreted_need,
                    'quote': verbatim_quote,
                    'sentiment': mapping.get('sentiment')
                })

        # Get key topics from theme_summary top_signals
        key_topics = []
        for theme_id, summary_data in theme_summary.items():
            if isinstance(summary_data, dict):
                top_signals = summary_data.get('top_signals', [])
                key_topics.extend(top_signals)

        # Also check legacy locations
        summary = (
            extracted_data.get('summary') or
            extracted_data.get('executive_summary') or
            key_insights.get('summary') or
            ''
        )

        # Build header
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📊 New Transcript Insight",
                    "emoji": True
                }
            }
        ]

        # Add call/transcript info section
        source_title = classification.source_title or classification.source_id
        source_info = f"*Source:* {classification.source_type.upper()}"
        if source_title:
            source_info += f"\n*Title:* {source_title}"

        # Add company name if available and not "Unknown"
        company_name = (
            customer_metadata.get('company_name') or
            customer_metadata.get('company') or
            transcript_metadata.get('company_name') or
            extracted_data.get('company_name') or
            ''
        )
        if company_name and company_name.lower() not in ['unknown', 'n/a', 'none', '']:
            source_info += f"\n*Company:* {company_name}"

        # Add participants/attendees if available
        participants = (
            transcript_metadata.get('participants', []) or
            transcript_metadata.get('attendees', []) or
            call_metadata.get('participants', []) or
            call_metadata.get('attendees', []) or
            customer_metadata.get('participants', []) or
            extracted_data.get('participants', []) or
            extracted_data.get('attendees', []) or
            extracted_data.get('parties', []) or
            []
        )
        if participants:
            # Handle different formats: list of strings or list of dicts
            participant_names = []
            for p in participants:
                if isinstance(p, str):
                    participant_names.append(p)
                elif isinstance(p, dict):
                    name = p.get('name') or p.get('displayName') or p.get('full_name') or ''
                    email = p.get('email') or p.get('emailAddress') or ''
                    if name and name.lower() not in ['unknown', 'unknown speaker']:
                        participant_names.append(name)
                    elif email:
                        participant_names.append(email.split('@')[0])  # Use email prefix as name
            if participant_names:
                source_info += f"\n*Participants:* {', '.join(participant_names[:5])}"
                if len(participant_names) > 5:
                    source_info += f" (+{len(participant_names) - 5} more)"

        # Add call type if available
        call_type = call_metadata.get('call_type') or transcript_metadata.get('call_type')
        if call_type:
            source_info += f"\n*Call Type:* {call_type.replace('_', ' ').title()}"

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": source_info
            }
        })

        # Add theme info
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Theme:* {theme.name}"
            }
        })

        blocks.append({"type": "divider"})

        # Add executive summary if available
        if summary:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*📋 Summary:*\n{summary[:500]}"
                }
            })

        # Add key topics from theme_summary.top_signals or legacy locations
        if not key_topics:
            key_topics = (
                key_insights.get('key_topics', []) or
                key_insights.get('topics', []) or
                extracted_data.get('key_topics', [])
            )
        if key_topics:
            topics_text = ", ".join(str(t) for t in key_topics[:5])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🔑 Key Topics:*\n{topics_text}"
                }
            })

        # Add pain points from mappings (signal_type=pain_point) or legacy locations
        if pain_points_from_mappings:
            pain_text_parts = []
            for pp in pain_points_from_mappings[:5]:
                pain_item = f"• {pp['need']}"
                if pp.get('quote'):
                    pain_item += f"\n  > _{pp['quote'][:100]}{'...' if len(pp['quote']) > 100 else ''}_"
                pain_text_parts.append(pain_item)
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*😣 Pain Points ({len(pain_points_from_mappings)}):*\n" + "\n".join(pain_text_parts)
                }
            })
        else:
            # Fallback to legacy pain_points
            pain_points = key_insights.get('pain_points', []) or extracted_data.get('pain_points', [])
            if pain_points:
                pain_text = "\n".join([f"• {p}" for p in pain_points[:5]])
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*😣 Pain Points:*\n{pain_text}"
                    }
                })

        # Add feature requests from mappings (signal_type=feature_request)
        if feature_requests_from_mappings:
            blocks.append({"type": "divider"})
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*💡 Feature Requests ({len(feature_requests_from_mappings)}):*"
                }
            })
            for fr in feature_requests_from_mappings[:5]:
                fr_text = f"*{fr['need']}*"
                if fr.get('quote'):
                    fr_text += f"\n> _{fr['quote'][:150]}{'...' if len(fr['quote']) > 150 else ''}_"
                if fr.get('reasoning'):
                    fr_text += f"\n_Reasoning: {fr['reasoning'][:100]}{'...' if len(fr['reasoning']) > 100 else ''}_"
                if fr.get('confidence'):
                    fr_text += f" | Confidence: {fr['confidence']}%"
                if fr.get('impact'):
                    fr_text += f" | Impact: {fr['impact']}%"
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": fr_text
                    }
                })

        # Add competitive mentions from mappings (signal_type=competitive_mention)
        if competitive_from_mappings:
            comp_text_parts = []
            for cm in competitive_from_mappings[:3]:
                comp_item = f"• {cm['need'] or cm['quote']}"
                if cm.get('need') and cm.get('quote'):
                    comp_item += f"\n  > _{cm['quote'][:100]}{'...' if len(cm['quote']) > 100 else ''}_"
                comp_text_parts.append(comp_item)
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🏢 Competitive Mentions:*\n" + "\n".join(comp_text_parts)
                }
            })

        # Add feedback from mappings (signal_type=feedback)
        if feedback_from_mappings:
            feedback_text_parts = []
            for fb in feedback_from_mappings[:3]:
                sentiment_emoji = "👍" if fb.get('sentiment', 0) > 0 else "👎" if fb.get('sentiment', 0) < 0 else "➡️"
                fb_item = f"• {sentiment_emoji} {fb['need']}"
                if fb.get('quote'):
                    fb_item += f"\n  > _{fb['quote'][:100]}{'...' if len(fb['quote']) > 100 else ''}_"
                feedback_text_parts.append(fb_item)
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*💬 Feedback:*\n" + "\n".join(feedback_text_parts)
                }
            })

        blocks.append({"type": "divider"})

        # Add risk assessment from transcript_metadata or legacy locations
        churn_risk = transcript_metadata.get('churn_risk') or risk_assessment.get('churn_risk')
        expansion_signal = transcript_metadata.get('expansion_signal') or risk_assessment.get('expansion_signal')
        deal_risk = risk_assessment.get('deal_risk')

        if deal_risk or churn_risk or expansion_signal:
            risk_fields = []
            if deal_risk and str(deal_risk).lower() not in ['n/a', 'none', '']:
                risk_emoji = "🔴" if str(deal_risk).lower() == "high" else "🟡" if str(deal_risk).lower() == "medium" else "🟢"
                risk_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Deal Risk:*\n{risk_emoji} {str(deal_risk).title()}"
                })
            if churn_risk and str(churn_risk).lower() not in ['n/a', 'none', '']:
                churn_emoji = "🔴" if str(churn_risk).lower() == "high" else "🟡" if str(churn_risk).lower() == "medium" else "🟢"
                risk_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Churn Risk:*\n{churn_emoji} {str(churn_risk).title()}"
                })
            if expansion_signal and str(expansion_signal).lower() not in ['n/a', 'none', '']:
                exp_emoji = "📈" if str(expansion_signal).lower() in ["high", "strong"] else "➡️"
                risk_fields.append({
                    "type": "mrkdwn",
                    "text": f"*Expansion Signal:*\n{exp_emoji} {str(expansion_signal).title()}"
                })

            if risk_fields:
                blocks.append({
                    "type": "section",
                    "fields": risk_fields[:3]
                })

        # Add sentiment from transcript_metadata or legacy
        sentiment = transcript_metadata.get('overall_sentiment') or call_metadata.get('overall_sentiment')
        if sentiment is not None:
            try:
                sentiment_val = float(sentiment)
                if sentiment_val > 0.1:
                    sentiment_text = "😊 Positive"
                elif sentiment_val < -0.1:
                    sentiment_text = "😟 Negative"
                else:
                    sentiment_text = "😐 Neutral"
            except (ValueError, TypeError):
                sentiment_text = f"😐 {sentiment}"

            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Overall Sentiment:* {sentiment_text}"
                    }
                ]
            })

        # Add speaker info from transcript_metadata
        speaker_role = transcript_metadata.get('speaker_role')
        speaker_authority = transcript_metadata.get('speaker_authority')
        if speaker_role or speaker_authority:
            speaker_info = []
            if speaker_role:
                speaker_info.append(f"Role: {speaker_role}")
            if speaker_authority and speaker_authority != 'unknown':
                authority_emoji = "👔" if speaker_authority == "decision-maker" else "💼" if speaker_authority == "influencer" else "👤"
                speaker_info.append(f"{authority_emoji} {speaker_authority.replace('-', ' ').title()}")
            if speaker_info:
                blocks.append({
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Speaker:* {' | '.join(speaker_info)}"
                        }
                    ]
                })

        # Add unmapped signals if any (potential new themes)
        if unmapped_signals:
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"💡 _{len(unmapped_signals)} unmapped signal(s) detected - may suggest new themes_"
                    }
                ]
            })

        # Summary of all mappings at the end
        if mappings:
            blocks.append({
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"📊 *Total:* {len(mappings)} signal(s) mapped | {len(feature_requests_from_mappings)} feature request(s) | {len(pain_points_from_mappings)} pain point(s) | {len(competitive_from_mappings)} competitive mention(s)"
                    }
                ]
            })

        return blocks

    @staticmethod
    async def send_notifications_for_classification(
        db: Session,
        classification: TranscriptClassification,
        theme_ids: List[UUID]
    ) -> Dict[str, Any]:
        """
        Send notifications to all themes associated with a transcript classification.

        Args:
            db: Database session
            classification: The transcript classification
            theme_ids: List of theme IDs to send notifications to

        Returns:
            Dict with success count and failures
        """
        success_count = 0
        failures = []

        for theme_id in theme_ids:
            try:
                result = await ThemeSlackNotificationService.send_transcript_insight_notification(
                    db=db,
                    theme_id=theme_id,
                    classification=classification
                )
                if result:
                    success_count += 1
            except Exception as e:
                logger.error(f"Failed to send notification for theme {theme_id}: {e}")
                failures.append(str(theme_id))

        return {
            "sent": success_count,
            "failed": len(failures),
            "failed_themes": failures
        }


# Global service instance
theme_slack_notification_service = ThemeSlackNotificationService()

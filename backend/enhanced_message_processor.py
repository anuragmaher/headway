#!/usr/bin/env python3
"""
Enhanced Message Processing Script with 3-Level LLM Categorization

This script processes all messages in the database using a 3-step LLM approach:
1. Theme categorization - Match message to existing parent themes
2. Sub-theme categorization - Match message to existing sub-themes under the selected theme
3. Feature matching & signal extraction - Match to existing features or create new ones with signals

Usage:
    python enhanced_message_processor.py --workspace-id <workspace_id> [--limit <number>] [--dry-run]
"""

import argparse
import json
import logging
import os
import sys
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass
import uuid

# Add the app directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from openai import OpenAI

from app.core.database import get_db
from app.models.message import Message
from app.models.feature import Feature
from app.models.theme import Theme
from app.models.workspace import Workspace
from app.models.workspace_data_point import WorkspaceDataPoint


@dataclass
class ProcessingResult:
    """Result of processing a single message"""
    message_id: str
    step_reached: int  # 1, 2, or 3
    theme_id: Optional[str] = None
    sub_theme_id: Optional[str] = None
    feature_id: Optional[str] = None
    feature_created: bool = False
    data_points_extracted: Dict[str, Any] = None
    error: Optional[str] = None


class EnhancedMessageProcessor:
    """Enhanced message processor with 3-level LLM categorization"""

    def __init__(self):
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

        # Initialize OpenAI client
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        self.openai_client = OpenAI(api_key=api_key)

        # Processing statistics
        self.stats = {
            "total_messages": 0,
            "processed_messages": 0,
            "step1_success": 0,  # Combined Theme+Sub-theme categorization
            "step2_success": 0,  # Feature matching/creation
            "sub_theme_matches": 0,  # How many had sub-theme matches
            "features_created": 0,
            "features_updated": 0,
            "errors": 0
        }

    def process_workspace_messages(
        self,
        workspace_id: str,
        limit: Optional[int] = None,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Process all messages in a workspace using 3-level categorization

        Args:
            workspace_id: UUID of the workspace
            limit: Optional limit on number of messages to process
            dry_run: If True, don't save changes to database

        Returns:
            Dictionary with processing results and statistics
        """
        self.logger.info(f"Starting enhanced message processing for workspace {workspace_id}")
        self.logger.info(f"Dry run mode: {dry_run}")

        db = next(get_db())
        results = []

        try:
            # Validate workspace exists
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                raise ValueError(f"Workspace {workspace_id} not found")

            # Get unprocessed messages
            messages = self._get_unprocessed_messages(db, workspace_id, limit)
            self.stats["total_messages"] = len(messages)

            self.logger.info(f"Found {len(messages)} messages to process")

            # Get existing themes and features for context
            themes = self._get_workspace_themes(db, workspace_id)
            features = self._get_workspace_features(db, workspace_id)

            self.logger.info(f"Workspace has {len(themes)} themes and {len(features)} features")

            # Process each message through the 3-level pipeline
            for i, message in enumerate(messages):
                self.logger.info(f"Processing message {i+1}/{len(messages)}: {message.id}")

                try:
                    result = self._process_single_message(
                        message, themes, features, workspace_id, db, dry_run
                    )
                    results.append(result)
                    self.stats["processed_messages"] += 1

                except Exception as e:
                    self.logger.error(f"Error processing message {message.id}: {e}")
                    results.append(ProcessingResult(
                        message_id=str(message.id),
                        step_reached=0,
                        error=str(e)
                    ))
                    self.stats["errors"] += 1

            if not dry_run:
                db.commit()
                self.logger.info("Changes committed to database")
            else:
                self.logger.info("Dry run - no changes saved to database")

            return {
                "status": "success",
                "statistics": self.stats,
                "results": results[:100] if len(results) > 100 else results  # Limit for readability
            }

        except Exception as e:
            self.logger.error(f"Fatal error in message processing: {e}")
            db.rollback()
            raise
        finally:
            db.close()

    def _get_unprocessed_messages(
        self,
        db: Session,
        workspace_id: str,
        limit: Optional[int] = None
    ) -> List[Message]:
        """Get messages that haven't been processed yet"""
        query = db.query(Message).filter(
            Message.workspace_id == workspace_id,
            Message.is_processed == False,
            Message.content.isnot(None),
            Message.content != ""
        ).order_by(Message.sent_at.desc())

        if limit:
            query = query.limit(limit)

        return query.all()

    def _get_workspace_themes(self, db: Session, workspace_id: str) -> List[Theme]:
        """Get all themes for workspace with hierarchy"""
        return db.query(Theme).filter(
            Theme.workspace_id == workspace_id
        ).order_by(Theme.name).all()

    def _get_workspace_features(self, db: Session, workspace_id: str) -> List[Feature]:
        """Get all features for workspace"""
        return db.query(Feature).filter(
            Feature.workspace_id == workspace_id
        ).order_by(Feature.created_at.desc()).all()

    def _process_single_message(
        self,
        message: Message,
        themes: List[Theme],
        features: List[Feature],
        workspace_id: str,
        db: Session,
        dry_run: bool
    ) -> ProcessingResult:
        """Process a single message through the 3-level pipeline"""

        result = ProcessingResult(message_id=str(message.id), step_reached=0)

        try:
            # Step 1: Combined Theme & Sub-theme Categorization
            self.logger.info(f"Step 1: Combined theme/sub-theme categorization for message {message.id}")
            theme_result = self._categorize_to_theme_hierarchy(message, themes)

            if not theme_result or not theme_result.get("theme_id"):
                result.error = "No suitable theme found"
                return result

            theme_id = theme_result.get("theme_id")
            sub_theme_id = theme_result.get("sub_theme_id")

            # Handle null values properly
            if theme_id == "null":
                theme_id = None
            if sub_theme_id == "null":
                sub_theme_id = None

            # Check if we have a valid theme_id
            if not theme_id:
                result.error = "No valid theme found"
                return result

            result.theme_id = theme_id
            result.step_reached = 1
            self.stats["step1_success"] += 1

            if sub_theme_id:
                result.sub_theme_id = sub_theme_id
                self.stats["sub_theme_matches"] += 1

            # Step 2: Feature Matching & Signal Extraction
            self.logger.info(f"Step 2: Feature matching for message {message.id}")
            target_theme_id = sub_theme_id if sub_theme_id else theme_id

            # Get features for the target theme
            theme_features = [f for f in features if str(f.theme_id) == target_theme_id]

            feature_result = self._match_or_create_feature(
                message, theme_features, target_theme_id, workspace_id, db, dry_run
            )

            if feature_result:
                result.feature_id = feature_result.get("feature_id")
                result.feature_created = feature_result.get("created", False)
                result.data_points_extracted = feature_result.get("data_points", {})
                result.step_reached = 2
                self.stats["step2_success"] += 1

                if result.feature_created:
                    self.stats["features_created"] += 1
                else:
                    self.stats["features_updated"] += 1

            # Mark message as processed
            if not dry_run:
                message.is_processed = True
                message.processed_at = datetime.utcnow()

            return result

        except Exception as e:
            result.error = str(e)
            self.logger.error(f"Error in _process_single_message: {e}")
            return result

    def _categorize_to_theme_hierarchy(self, message: Message, themes: List[Theme]) -> Optional[Dict[str, str]]:
        """Step 1: Use LLM to categorize message to theme and sub-theme in one call"""

        # Organize themes into hierarchy
        parent_themes = [t for t in themes if not t.parent_theme_id]
        theme_hierarchy = {}

        for parent in parent_themes:
            sub_themes = [t for t in themes if t.parent_theme_id and str(t.parent_theme_id) == str(parent.id)]
            theme_hierarchy[str(parent.id)] = {
                "theme": parent,
                "sub_themes": sub_themes
            }

        if not parent_themes:
            self.logger.warning("No parent themes available")
            return None

        prompt = self._build_combined_theme_categorization_prompt(message, theme_hierarchy)

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )

            result = self._parse_theme_hierarchy_response(response.choices[0].message.content)
            return result

        except Exception as e:
            self.logger.error(f"Error in theme hierarchy categorization: {e}")
            return None

    def _match_or_create_feature(
        self,
        message: Message,
        theme_features: List[Feature],
        theme_id: str,
        workspace_id: str,
        db: Session,
        dry_run: bool
    ) -> Optional[Dict[str, Any]]:
        """Step 3: Use LLM to match existing feature or create new one with signals"""

        prompt = self._build_feature_matching_prompt(message, theme_features)

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )

            result = self._parse_feature_response(response.choices[0].message.content)

            if result.get("action") == "match_existing":
                # Update existing feature
                feature_id = result.get("feature_id")
                feature = db.query(Feature).filter(Feature.id == feature_id).first()

                if feature and not dry_run:
                    # Add message to feature if not already linked
                    if message not in feature.messages:
                        feature.messages.append(message)
                        feature.mention_count += 1
                        feature.last_mentioned = message.sent_at
                        feature.updated_at = datetime.utcnow()

                        # Accumulate data points from new messages
                        existing_data = feature.data_points or []
                        new_data_points = result.get("data_points", {})

                        # Add timestamp and source info to new data points
                        if new_data_points:
                            # Process business metrics to make them numeric
                            processed_data_points = self._process_business_metrics(new_data_points)

                            timestamped_data = {
                                "timestamp": message.sent_at.isoformat(),
                                "message_id": str(message.id),
                                "author": message.author_name,
                                **processed_data_points
                            }
                            existing_data.append(timestamped_data)
                            feature.data_points = existing_data

                            # Save data points to lookup table for aggregation
                            self._save_data_points_to_lookup_table(
                                new_data_points, workspace_id, str(feature.id), str(message.id), message, db
                            )

                return {
                    "feature_id": feature_id,
                    "created": False,
                    "data_points": result.get("data_points", {})
                }

            elif result.get("action") == "create_new":
                # Create new feature
                if not dry_run:
                    new_feature = Feature(
                        name=result.get("feature_name"),
                        description=result.get("feature_description"),
                        urgency=result.get("urgency", "medium"),
                        status="new",
                        mention_count=1,
                        workspace_id=workspace_id,
                        theme_id=theme_id,
                        first_mentioned=message.sent_at,
                        last_mentioned=message.sent_at,
                        data_points=[{
                            "timestamp": message.sent_at.isoformat(),
                            "message_id": str(message.id),
                            "author": message.author_name,
                            **self._process_business_metrics(result.get("data_points", {}))
                        }] if result.get("data_points") else []  # Save structured data points
                    )

                    db.add(new_feature)
                    db.flush()  # Get the ID

                    new_feature.messages.append(message)

                    # Save data points to lookup table for aggregation
                    if result.get("data_points"):
                        self._save_data_points_to_lookup_table(
                            result.get("data_points", {}), workspace_id, str(new_feature.id), str(message.id), message, db
                        )

                    return {
                        "feature_id": str(new_feature.id),
                        "created": True,
                        "data_points": result.get("data_points", {})
                    }
                else:
                    # Dry run - simulate creation
                    return {
                        "feature_id": str(uuid.uuid4()),
                        "created": True,
                        "data_points": result.get("data_points", {})
                    }

            return None

        except Exception as e:
            self.logger.error(f"Error in feature matching: {e}")
            return None

    def _build_combined_theme_categorization_prompt(
        self,
        message: Message,
        theme_hierarchy: Dict[str, Dict]
    ) -> str:
        """Build prompt for combined theme and sub-theme categorization"""

        hierarchy_text = "AVAILABLE THEMES AND SUB-THEMES:\n\n"

        for theme_id, theme_data in theme_hierarchy.items():
            theme = theme_data["theme"]
            sub_themes = theme_data["sub_themes"]

            hierarchy_text += f"THEME: {theme.name} (ID: {theme.id})\n"
            hierarchy_text += f"Description: {theme.description}\n"

            if sub_themes:
                hierarchy_text += f"Sub-themes under '{theme.name}':\n"
                for sub in sub_themes:
                    hierarchy_text += f"  - {sub.name} (ID: {sub.id})\n"
                    hierarchy_text += f"    Description: {sub.description}\n"
            else:
                hierarchy_text += f"No sub-themes under '{theme.name}'\n"

            hierarchy_text += "\n"

        return f"""You are an expert at categorizing customer feedback into product themes and sub-themes.

{hierarchy_text}

MESSAGE TO CATEGORIZE:
Content: {message.content}
Channel: {message.channel_name}
Author: {message.author_name}
Date: {message.sent_at}

Your task:
1. First determine which main THEME this message best fits into
2. Then determine if it fits into a specific SUB-THEME (if available for that theme)

Consider:
- The main topic/category the message relates to
- The specific aspect or functionality being discussed
- Similar features or requests that would logically group together

IMPORTANT:
- Always select a main theme
- Only select a sub-theme if one clearly fits (it's okay to leave sub_theme_id as null)
- Use exact IDs from the list above

Respond in JSON format:
{{
    "theme_id": "uuid-of-selected-theme",
    "sub_theme_id": "uuid-of-selected-sub-theme-or-null",
    "confidence": 0.85,
    "reasoning": "Brief explanation of why these themes were chosen"
}}"""

    def _build_feature_matching_prompt(
        self,
        message: Message,
        theme_features: List[Feature]
    ) -> str:
        """Build prompt for feature matching and signal extraction (Step 3)"""

        features_text = "EXISTING FEATURES IN THIS THEME:\n"
        if theme_features:
            for feature in theme_features:
                features_text += f"- ID: {feature.id}\n"
                features_text += f"  Name: {feature.name}\n"
                features_text += f"  Description: {feature.description}\n"
                features_text += f"  Mentions: {feature.mention_count}\n"
                features_text += f"  Status: {feature.status}\n"
                features_text += f"  Urgency: {feature.urgency}\n\n"
        else:
            features_text += "No existing features in this theme.\n\n"

        return f"""You are an expert at analyzing customer feedback to identify product features and extract important signals.

{features_text}

MESSAGE TO ANALYZE:
Content: {message.content}
Channel: {message.channel_name}
Author: {message.author_name}
Date: {message.sent_at}

Your task:
1. Determine if this message matches an EXISTING feature or needs a NEW feature
2. Extract important signals/insights from the message

For EXISTING features: Look for messages requesting the same or very similar functionality
For NEW features: The request should be distinct and not covered by existing features

IMPORTANT DATA POINTS to extract:

STRUCTURED METRICS:
- Urgency Score (1-10): Based on language intensity and blocking factors
- User Impact (low/medium/high): How many users affected or importance level
- Business Value (none/low/medium/high): Revenue, efficiency, competitive advantage
- Implementation Complexity (simple/moderate/complex): Technical difficulty assessment
- User Sentiment (negative/neutral/positive): Overall tone about current state
- Pain Level (1-10): How much friction/frustration is expressed
- Competitive Pressure (yes/no): Are competitors mentioned or implied
- Frequency Indicators: Words like "always", "often", "daily", "never"

DYNAMIC BUSINESS METRICS (extract any mentioned):
- Revenue figures (MRR, ARR, deal size, contract value, etc.)
- Customer metrics (churn rate, conversion rate, user count, etc.)
- Performance metrics (response time, uptime, efficiency gains, etc.)
- Cost metrics (savings, expenses, budget impact, etc.)
- Time metrics (processing time, setup time, delays, etc.)

ENTITIES AND CONTEXT (extract any mentioned):
- Customer/Company names
- Team/Department names
- Product names or features
- Integration names (Slack, Salesforce, etc.)
- Geographic locations
- Dates and deadlines
- Specific roles/job titles

EXTRACTION INSTRUCTIONS:
- For business_metrics: Look for ANY numbers with business context (revenue, costs, time, users, percentages, etc.)
- For entities: Extract ANY proper nouns that represent people, companies, products, places, or specific things
- If no metrics or entities are mentioned, use empty objects {{}} for those fields
- IMPORTANT: Extract numeric values as actual numbers when possible (1175 instead of "$1175", 50 instead of "50 users")
- For non-numeric context, keep as strings ("Q4 2025", "3 customers", "Salesforce")
- Don't force data points - only extract what's actually mentioned in the message

Respond in JSON format:

For existing feature match:
{{
    "action": "match_existing",
    "feature_id": "uuid-of-matching-feature",
    "confidence": 0.85,
    "reasoning": "Why this matches the existing feature",
    "data_points": {{
        "urgency_score": 7,
        "user_impact": "high",
        "business_value": "medium",
        "implementation_complexity": "moderate",
        "user_sentiment": "negative",
        "pain_level": 8,
        "competitive_pressure": "no",
        "frequency_indicators": ["daily", "always"],
        "business_metrics": {{
            "mrr_impact": 5000,
            "users_affected": 150,
            "time_savings_hours": 2
        }},
        "entities": {{
            "customer_name": "Acme Corp",
            "team": "Sales Team",
            "integrations": ["Salesforce", "Slack"]
        }}
    }}
}}

For new feature:
{{
    "action": "create_new",
    "feature_name": "Clear, specific feature name",
    "feature_description": "Detailed description of the feature request",
    "urgency": "low|medium|high|critical",
    "reasoning": "Why this needs a new feature",
    "data_points": {{
        "urgency_score": 6,
        "user_impact": "medium",
        "business_value": "high",
        "implementation_complexity": "simple",
        "user_sentiment": "neutral",
        "pain_level": 5,
        "competitive_pressure": "yes",
        "frequency_indicators": ["often", "sometimes"],
        "business_metrics": {{
            "potential_revenue": 10000,
            "churn_risk_customers": 3,
            "efficiency_gain_percent": 50
        }},
        "entities": {{
            "customer_name": "TechStart Inc",
            "department": "Customer Success",
            "deadline": "Q4 2025",
            "role": "Account Manager"
        }}
    }}
}}

For non-feature requests:
{{
    "action": "ignore",
    "reasoning": "Why this is not a feature request"
}}"""

    def _parse_theme_hierarchy_response(self, response_text: str) -> Dict[str, Any]:
        """Parse combined theme hierarchy categorization response"""
        return self._parse_json_response(response_text)

    def _parse_feature_response(self, response_text: str) -> Dict[str, Any]:
        """Parse feature matching response"""
        return self._parse_json_response(response_text)

    def _parse_json_response(self, response_text: str) -> Dict[str, Any]:
        """Generic JSON response parser"""
        try:
            # Find JSON in response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1

            if start_idx == -1 or end_idx == 0:
                self.logger.error("No JSON found in LLM response")
                return {}

            json_text = response_text[start_idx:end_idx]
            return json.loads(json_text)

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            return {}

    def _process_business_metrics(self, data_points: Dict[str, Any]) -> Dict[str, Any]:
        """Convert string numbers to actual numbers recursively"""
        if not data_points:
            return data_points

        return self._convert_string_numbers(data_points)

    def _convert_string_numbers(self, obj):
        """Recursively convert string numbers to integers/floats"""
        if isinstance(obj, dict):
            return {key: self._convert_string_numbers(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_string_numbers(item) for item in obj]
        elif isinstance(obj, str):
            # Try to convert string to number if it's purely numeric
            if obj.isdigit():
                return int(obj)
            else:
                try:
                    # Try float conversion for decimals
                    if '.' in obj and obj.replace('.', '').isdigit():
                        return float(obj)
                except ValueError:
                    pass
            return obj  # Keep as string if not numeric
        else:
            return obj  # Return as-is for other types

    def _save_data_points_to_lookup_table(
        self,
        data_points: Dict[str, Any],
        workspace_id: str,
        feature_id: str,
        message_id: str,
        message: Message,
        db: Session
    ):
        """Extract and save individual data points to workspace_data_points table for aggregation"""

        if not data_points:
            return

        author = data_points.get("author", message.author_name)

        # Save structured metrics
        structured_fields = [
            "urgency_score", "user_impact", "business_value",
            "implementation_complexity", "user_sentiment", "pain_level",
            "competitive_pressure"
        ]

        for field in structured_fields:
            if field in data_points:
                value = data_points[field]
                data_point = WorkspaceDataPoint(
                    workspace_id=workspace_id,
                    feature_id=feature_id,
                    message_id=message_id,
                    data_point_key=field,
                    data_point_category="structured_metrics",
                    author=author
                )

                # Store based on value type
                if isinstance(value, int):
                    data_point.integer_value = value
                elif isinstance(value, float):
                    data_point.numeric_value = value
                else:
                    data_point.text_value = str(value)

                db.add(data_point)

        # Save business metrics
        business_metrics = data_points.get("business_metrics", {})
        for key, value in business_metrics.items():
            data_point = WorkspaceDataPoint(
                workspace_id=workspace_id,
                feature_id=feature_id,
                message_id=message_id,
                data_point_key=key,
                data_point_category="business_metrics",
                author=author
            )

            if isinstance(value, int):
                data_point.integer_value = value
            elif isinstance(value, float):
                data_point.numeric_value = value
            else:
                data_point.text_value = str(value)

            db.add(data_point)

        # Save entities
        entities = data_points.get("entities", {})
        for key, value in entities.items():
            if value:  # Only save non-empty entities
                data_point = WorkspaceDataPoint(
                    workspace_id=workspace_id,
                    feature_id=feature_id,
                    message_id=message_id,
                    data_point_key=key,
                    data_point_category="entities",
                    text_value=str(value),
                    author=author
                )
                db.add(data_point)

    def print_statistics(self):
        """Print processing statistics"""
        print("\n" + "="*60)
        print("ENHANCED MESSAGE PROCESSING STATISTICS (2-STEP)")
        print("="*60)
        print(f"Total messages found: {self.stats['total_messages']}")
        print(f"Messages processed: {self.stats['processed_messages']}")
        print(f"Step 1 (Theme+Sub-theme) success: {self.stats['step1_success']}")
        print(f"  └─ Sub-theme matches: {self.stats['sub_theme_matches']}")
        print(f"Step 2 (Feature) success: {self.stats['step2_success']}")
        print(f"Features created: {self.stats['features_created']}")
        print(f"Features updated: {self.stats['features_updated']}")
        print(f"Errors: {self.stats['errors']}")
        print("="*60)


def main():
    """Main function for command line usage"""
    parser = argparse.ArgumentParser(description='Enhanced Message Processor with 3-Level LLM Categorization')
    parser.add_argument('--workspace-id', required=True, help='Workspace ID to process')
    parser.add_argument('--limit', type=int, help='Limit number of messages to process')
    parser.add_argument('--dry-run', action='store_true', help='Run without saving changes')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        processor = EnhancedMessageProcessor()

        result = processor.process_workspace_messages(
            workspace_id=args.workspace_id,
            limit=args.limit,
            dry_run=args.dry_run
        )

        processor.print_statistics()

        print(f"\nProcessing completed successfully!")
        print(f"Status: {result['status']}")

        if args.verbose and result.get('results'):
            print(f"\nFirst 10 results:")
            for i, res in enumerate(result['results'][:10]):
                print(f"{i+1}. Message {res.message_id}: Step {res.step_reached}")
                if res.error:
                    print(f"   Error: {res.error}")
                if res.feature_created:
                    print(f"   Created feature: {res.feature_id}")
                if res.data_points_extracted:
                    print(f"   Data Points: {len(res.data_points_extracted)} extracted")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
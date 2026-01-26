#!/usr/bin/env python
"""
Fetch Fathom Transcripts

Fetches the last N Fathom meeting transcripts for a workspace
and saves them as JSON + TXT files.
Optionally processes transcripts with AI classification and saves analysis results.

Usage:
    python scripts/fetch_fathom_transcript.py --email user@company.com
    python scripts/fetch_fathom_transcript.py --workspace-id <uuid>
    python scripts/fetch_fathom_transcript.py --limit 5

    # With AI classification (saves *_analysis.json files):
    python scripts/fetch_fathom_transcript.py --email user@company.com --limit 5 --use-langfuse
    python scripts/fetch_fathom_transcript.py --email user@company.com --limit 10 --use-langfuse --force
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import UUID

import requests
from sqlalchemy import and_
from sqlalchemy.orm import Session

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.config import settings
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.models.transcript_classification import TranscriptClassification
from app.models.theme import Theme
from app.models.sub_theme import SubTheme


FATHOM_API_BASE = "https://api.fathom.ai"

# ---------------------------------------------------------------------------
# Hiver Themes for AI Classification
# ---------------------------------------------------------------------------

HIVER_THEMES = [
    {
        "id": "a98ad030-84ee-4d2a-803a-5f965ddabf0d",
        "name": "Getting Started",
        "description": "Initial setup and onboarding for new users",
        "sort_order": 0,
        "sub_themes": [
            {"id": "60f63056-8dea-4c3a-8ccc-841e8376a57f", "name": "Account Setup", "description": "Create and configure your account", "sort_order": 0},
            {"id": "87670ad7-8ca7-490f-9cba-aa6384fddb13", "name": "First Steps", "description": "Basic actions to take after signup", "sort_order": 1},
            {"id": "9b797a07-1be7-4878-9910-449e9ad7d4ab", "name": "Gmail Integration", "description": "Connect Hiver with your Gmail", "sort_order": 2},
            {"id": "f0a73269-39fa-4d66-b938-dbaeffbbc321", "name": "Shared Inbox Setup", "description": "Establish a shared inbox for your team", "sort_order": 3},
            {"id": "3baa3697-3dec-475d-be00-16eba3c6b0b8", "name": "Import Data", "description": "Transfer existing data into Hiver", "sort_order": 4},
            {"id": "7e04cd1f-1834-49e1-90dc-f0c67bdfe2ac", "name": "Mobile Access", "description": "Using Hiver on mobile devices", "sort_order": 5}
        ]
    },
    {
        "id": "bb903958-9aa3-45d3-896a-098875b6f618",
        "name": "Multi-Channel Support",
        "description": "Manage customer interactions across various platforms",
        "sort_order": 1,
        "sub_themes": [
            {"id": "8a15346b-3b62-4768-803a-c8aad6aaa775", "name": "Email Management", "description": "Handle customer emails efficiently", "sort_order": 0},
            {"id": "87e6fcc7-bc7f-423e-bc67-59d653e1dc2b", "name": "Chat Support", "description": "Integrate chat for real-time support", "sort_order": 1},
            {"id": "3b7cf0c3-e8b6-475e-9f01-97cd03a02d2d", "name": "Social Media Integration", "description": "Connect social channels for support", "sort_order": 2},
            {"id": "516aa759-9346-4d10-9308-a9ed32c77364", "name": "Phone Support", "description": "Manage customer calls effectively", "sort_order": 3},
            {"id": "6b09ef31-1377-456c-8dda-69b3f4f4a2ad", "name": "Unified Inbox", "description": "Consolidate messages from all channels", "sort_order": 4},
            {"id": "77d9fa3a-bfea-445a-b939-e849b7889416", "name": "Response Templates", "description": "Use templates for quick replies", "sort_order": 5}
        ]
    },
    {
        "id": "25989a75-759b-4aea-a97d-0da42e6a5cbf",
        "name": "Workflow Automation",
        "description": "Streamline repetitive tasks with automation",
        "sort_order": 2,
        "sub_themes": [
            {"id": "ebff2f70-8581-4b67-adf6-80455f3b6beb", "name": "Rule Creation", "description": "Set rules for automated actions", "sort_order": 0},
            {"id": "17109f19-7c84-4eb5-bcfb-d35ddc474522", "name": "Task Assignment", "description": "Automatically assign tasks to team members", "sort_order": 1},
            {"id": "c5610224-1eb7-49d3-b2f6-53a08a0fe5cf", "name": "Email Triggers", "description": "Trigger actions based on email events", "sort_order": 2},
            {"id": "12fa1017-4651-44ed-b8fb-e5c618c1d595", "name": "Follow-Up Reminders", "description": "Automate reminders for follow-ups", "sort_order": 3},
            {"id": "86ab8d45-7651-48dc-af0d-e95488e625e9", "name": "SLA Management", "description": "Manage service level agreements efficiently", "sort_order": 4},
            {"id": "6e11736d-1f5c-4c62-8419-e8570353cf20", "name": "Performance Reports", "description": "Generate reports on automated tasks", "sort_order": 5}
        ]
    },
    {
        "id": "50fbdd18-0a06-4a9a-b974-9a5139365c0a",
        "name": "Team Collaboration",
        "description": "Enhance teamwork and communication within Hiver",
        "sort_order": 3,
        "sub_themes": [
            {"id": "6738bd6c-4d49-4c6d-80dd-45cb6f15e037", "name": "Shared Notes", "description": "Collaborate on notes within Hiver", "sort_order": 0},
            {"id": "2c77ba0f-5d6f-49e4-b3bb-91e03e18ad7a", "name": "Conversation Assignment", "description": "Assign conversations to team members", "sort_order": 1},
            {"id": "5b9e4453-2b10-4b62-859f-7a57ba1793af", "name": "Approval Workflows", "description": "Manage approvals within the team", "sort_order": 2},
            {"id": "ebbaa53a-48dc-4247-914f-924e155f3d60", "name": "Internal Comments", "description": "Add comments for team discussions", "sort_order": 3},
            {"id": "64dac13a-c2a0-428e-9be6-0779ac49b160", "name": "Task Management", "description": "Track tasks assigned to team members", "sort_order": 4},
            {"id": "235612a9-66d8-4a85-9af2-ff61724aa4d8", "name": "Collaboration Tools", "description": "Utilize tools for effective teamwork", "sort_order": 5}
        ]
    },
    {
        "id": "4810ba4f-d7b6-4814-a5b9-2b5d29dc0687",
        "name": "AI Features",
        "description": "Leverage AI to boost productivity and efficiency",
        "sort_order": 4,
        "sub_themes": [
            {"id": "8e8dfd3a-576c-4ac8-a541-098b16cae7af", "name": "Smart Suggestions", "description": "Get AI-driven suggestions for responses", "sort_order": 0},
            {"id": "46a8b261-737e-458e-9c76-d0370b91860b", "name": "Sentiment Analysis", "description": "Analyze customer sentiment in interactions", "sort_order": 1},
            {"id": "afc3a16f-c884-45ce-8fea-3c403f85fb14", "name": "Automated Insights", "description": "Receive insights based on data analysis", "sort_order": 2},
            {"id": "d7249605-6cdf-4ff7-89df-9e23f8f5d8a2", "name": "Predictive Responses", "description": "Use AI to predict customer needs", "sort_order": 3},
            {"id": "f01e35f6-1190-494e-9a10-9e1e0fa56820", "name": "Performance Optimization", "description": "Optimize workflows with AI recommendations", "sort_order": 4},
            {"id": "9b437ad0-b43b-41a3-8a4b-82333d879fc5", "name": "Chatbot Integration", "description": "Integrate chatbots for customer support", "sort_order": 5}
        ]
    },
    {
        "id": "e8fae85a-f5dd-4d1f-ac3c-517b014fc03d",
        "name": "SLA Management",
        "description": "Set and manage service level agreements effectively",
        "sort_order": 5,
        "sub_themes": [
            {"id": "6d1359e8-c21e-40d0-8728-9ed1a8d48a0f", "name": "Response Time Targets", "description": "Define targets for response times", "sort_order": 0},
            {"id": "6b04d9f4-7713-4a62-aa07-08edf3c3ecaf", "name": "Resolution Time Goals", "description": "Set goals for resolving issues", "sort_order": 1},
            {"id": "b927151c-011b-47e3-9248-7a091d40ba87", "name": "Performance Tracking", "description": "Monitor SLA performance metrics", "sort_order": 2},
            {"id": "004d675b-a2b8-48bc-8e6f-4c437e1e5ea1", "name": "Alerts and Notifications", "description": "Receive alerts for SLA breaches", "sort_order": 3},
            {"id": "46bd358a-8811-4079-b1f1-db5c84977f5c", "name": "Reporting Tools", "description": "Generate reports on SLA compliance", "sort_order": 4},
            {"id": "a39afda4-3b06-4313-a18c-fd4e25501871", "name": "Team Accountability", "description": "Ensure team accountability for SLAs", "sort_order": 5}
        ]
    },
    {
        "id": "c1234567-89ab-4cde-f012-3456789abcde",
        "name": "Analytics & Reporting",
        "description": "Track performance and gain insights from data",
        "sort_order": 6,
        "sub_themes": [
            {"id": "d1234567-89ab-4cde-f012-3456789abcd1", "name": "Dashboard Overview", "description": "View key metrics at a glance", "sort_order": 0},
            {"id": "d1234567-89ab-4cde-f012-3456789abcd2", "name": "Team Performance", "description": "Monitor individual and team productivity", "sort_order": 1},
            {"id": "d1234567-89ab-4cde-f012-3456789abcd3", "name": "Customer Insights", "description": "Analyze customer behavior and trends", "sort_order": 2},
            {"id": "d1234567-89ab-4cde-f012-3456789abcd4", "name": "Custom Reports", "description": "Create tailored reports for specific needs", "sort_order": 3},
            {"id": "d1234567-89ab-4cde-f012-3456789abcd5", "name": "Export & Sharing", "description": "Export data and share reports", "sort_order": 4}
        ]
    },
    {
        "id": "e1234567-89ab-4cde-f012-3456789abcdf",
        "name": "Integrations",
        "description": "Connect Hiver with other tools and platforms",
        "sort_order": 7,
        "sub_themes": [
            {"id": "f1234567-89ab-4cde-f012-3456789abcd1", "name": "CRM Integration", "description": "Connect with Salesforce, HubSpot, etc.", "sort_order": 0},
            {"id": "f1234567-89ab-4cde-f012-3456789abcd2", "name": "Project Management", "description": "Integrate with Asana, Jira, Monday", "sort_order": 1},
            {"id": "f1234567-89ab-4cde-f012-3456789abcd3", "name": "Communication Tools", "description": "Connect with Slack, Teams, etc.", "sort_order": 2},
            {"id": "f1234567-89ab-4cde-f012-3456789abcd4", "name": "Zapier & Webhooks", "description": "Automate with Zapier and custom webhooks", "sort_order": 3},
            {"id": "f1234567-89ab-4cde-f012-3456789abcd5", "name": "API Access", "description": "Use Hiver API for custom integrations", "sort_order": 4}
        ]
    },
    {
        "id": "g1234567-89ab-4cde-f012-3456789abcdg",
        "name": "Live Chat & Knowledge Base",
        "description": "Provide self-service and real-time support",
        "sort_order": 8,
        "sub_themes": [
            {"id": "h1234567-89ab-4cde-f012-3456789abcd1", "name": "Live Chat Widget", "description": "Embed chat widget on your website", "sort_order": 0},
            {"id": "h1234567-89ab-4cde-f012-3456789abcd2", "name": "Chatbot Setup", "description": "Configure AI-powered chatbots", "sort_order": 1},
            {"id": "h1234567-89ab-4cde-f012-3456789abcd3", "name": "Knowledge Base Articles", "description": "Create and manage help articles", "sort_order": 2},
            {"id": "h1234567-89ab-4cde-f012-3456789abcd4", "name": "FAQ Management", "description": "Organize frequently asked questions", "sort_order": 3},
            {"id": "h1234567-89ab-4cde-f012-3456789abcd5", "name": "Self-Service Portal", "description": "Enable customers to find answers", "sort_order": 4}
        ]
    },
    {
        "id": "i1234567-89ab-4cde-f012-3456789abcdi",
        "name": "Billing & Account",
        "description": "Manage subscription, billing, and account settings",
        "sort_order": 9,
        "sub_themes": [
            {"id": "j1234567-89ab-4cde-f012-3456789abcd1", "name": "Subscription Plans", "description": "View and change subscription tiers", "sort_order": 0},
            {"id": "j1234567-89ab-4cde-f012-3456789abcd2", "name": "Payment Methods", "description": "Manage payment and billing info", "sort_order": 1},
            {"id": "j1234567-89ab-4cde-f012-3456789abcd3", "name": "User Management", "description": "Add, remove, and manage team members", "sort_order": 2},
            {"id": "j1234567-89ab-4cde-f012-3456789abcd4", "name": "Security Settings", "description": "Configure security and permissions", "sort_order": 3},
            {"id": "j1234567-89ab-4cde-f012-3456789abcd5", "name": "Data Export & Backup", "description": "Export data and manage backups", "sort_order": 4}
        ]
    }
]

# ---------------------------------------------------------------------------
# Classification Prompt Template
# ---------------------------------------------------------------------------

CLASSIFICATION_PROMPT = '''You are a product intelligence engine analyzing customer conversations for a B2B SaaS company. Your task is to extract actionable insights, map them to a predefined taxonomy, and score each signal to help product managers prioritize decisions.

## TAXONOMY
{{THEMES_JSON}}

## YOUR COMPANY CONTEXT
Company Name: Hiver
Company Domains: grexit.com, hiverhq.com

## TRANSCRIPT
{{TRANSCRIPT}}

---

## STEP 0: SPEAKER IDENTIFICATION (CRITICAL)

Before any analysis, identify all speakers and classify them:

**Rules:**
- Your team = anyone from Hiver or grexit.com, hiverhq.com
- Customer = the person from the external company (either prospect or existing customer)
- Determine customer_type based on context:
  - PROSPECT: Sales demo, discovery call, evaluation, trial discussion
  - EXISTING_CUSTOMER: Support call, QBR, check-in, renewal discussion, feature request from paying user
- All signal extraction focuses on the CUSTOMER's perspective only
- Ignore your team member's pitches — extract only what reveals customer needs, objections, and intent
- If your team member acknowledges a limitation or says "we don't have that", this CONFIRMS a blocker/gap

---

## STEP 1: EXTRACT SIGNALS

Analyze the transcript from the CUSTOMER's perspective. Extract every product-relevant signal.

### Signal Types

| Type | Description | Relevant For |
|------|-------------|--------------|
| feature_request | Explicit ask for functionality | Both |
| implicit_need | Workaround, manual process, or workflow revealing a gap | Both |
| pain_point | Frustration, inefficiency, or problem with current state | Both |
| deal_blocker | Stated requirement your product doesn't meet (pre-sale) | Prospect |
| adoption_blocker | Feature gap preventing deeper usage or rollout | Existing Customer |
| objection | Challenge to value prop, differentiation, or pricing | Both |
| competitive_intent | Mention of evaluating alternatives or switching | Both |
| competitive_mention | Reference to specific competitor (positive or negative) | Both |
| expansion_signal | Growth, new use cases, adding seats, new teams/departments | Existing Customer |
| churn_signal | Dissatisfaction, non-renewal hints, scaling down | Existing Customer |
| renewal_risk | Concerns about continuing, budget cuts, re-evaluation | Existing Customer |
| price_sensitivity | Concerns or questions about cost | Both |
| positive_feedback | Praise, validation, enthusiasm, success story | Both |
| support_issue | Bug, problem, or technical issue being reported | Existing Customer |
| onboarding_friction | Difficulty getting started or adopting features | Existing Customer |

---

## STEP 2: MAP TO TAXONOMY

For each signal from the CUSTOMER, map to the most relevant theme and sub-theme from {{THEMES_JSON}}.

**Mapping Rules:**
- Only map signals with confidence ≥ 50
- If no good match exists, add to unmapped_signals with suggested new theme/sub-theme
- One signal can map to multiple themes if genuinely relevant to both

---

## STEP 3: SCORE EACH MAPPING

### Confidence Score (0-100)
How certain is this mapping to this theme?
- 90-100: Explicit, unambiguous match to theme definition
- 70-89: Strong implicit match, clear intent
- 50-69: Reasonable interpretation, some ambiguity
- Below 50: Do not map — add to unmapped_signals or discard

### Impact Score (0-100)
How critical is this signal for product decisions?

**Scoring factors:**
- Urgency: "We need this" / blocking (+20) vs "Nice to have" (+5)
- Business consequence: Deal/churn blocker (+25) vs Minor preference (+5)
- Frequency: Repeated multiple times (+15) vs Mentioned once (+5)
- Authority: Decision-maker stated it (+15) vs End-user preference (+5)
- Explicit priority: "My core requirement" (+20) vs Casual question (+5)
- Customer value: High-value / strategic account (+10) vs New/small account (+0)

**Automatic high impact (80+):**
- Customer uses words like "requirement", "need", "must have", "dealbreaker", "blocker"
- Your team member explicitly says "we don't have that" or "not supported"
- Customer mentions evaluating competitors or considering switching
- Existing customer hints at non-renewal or scaling down

### Sentiment (-1 to 1)
- -1: Strongly negative (frustration, anger, churn language)
- 0: Neutral (informational, exploratory)
- +1: Strongly positive (enthusiasm, praise, success)

---

## STEP 4: DETERMINE RISK & OPPORTUNITY

### For PROSPECTS — Deal Risk

**HIGH:**
- Your team explicitly says product is "not a fit" or "not right for you"
- Customer states a core requirement that product doesn't meet
- Customer says they will "compare with competitors" or "look elsewhere"
- Customer questions fundamental differentiation
- deal_blocker signal exists with impact ≥ 80

**MEDIUM:**
- Unresolved objections at end of call
- Price sensitivity without resolution
- Key features only "coming soon" or on roadmap
- Customer is non-committal ("let me explore", "I'll get back")

**LOW:**
- No deal_blockers identified
- Customer shows clear interest and engagement
- Next steps established
- Core requirements can be met

### For EXISTING CUSTOMERS — Churn Risk

**HIGH:**
- Customer mentions evaluating alternatives or competitors
- Explicit dissatisfaction with product or support
- Mentions of budget cuts affecting renewal
- Key workflow broken or major pain unresolved
- "We might need to reconsider" or similar language
- adoption_blocker preventing expansion they wanted

**MEDIUM:**
- Frustration with specific features but still engaged
- Support issues taking too long to resolve
- Feature requests marked as "important for us to continue"
- Flat or declining usage mentioned

**LOW:**
- Generally satisfied, minor feedback only
- Engaged and asking about new features
- No competitive mentions
- Planning expansion or new use cases

### Expansion Signal (Existing Customers)

**HIGH:**
- Actively discussing adding seats, teams, or departments
- New use cases being explored
- Asking about higher-tier features or plans
- Success metrics shared, want to do more

**MEDIUM:**
- Interest in features they don't currently use
- Mentions of team growth or new projects
- Asking "can we also do X?"

**LOW/NONE:**
- Maintenance mode, no growth signals
- Focused only on current usage

---

## OUTPUT FORMAT

Return valid JSON only. No markdown, no explanation outside the JSON.

{
  "speakers": [
    {
      "name": "Speaker name",
      "email": "email if available",
      "company": "Company name",
      "role_type": "customer | your_team",
      "job_role": "Inferred job title/function",
      "authority_level": "decision-maker | influencer | end-user | unknown"
    }
  ],
  "customer_metadata": {
    "company_name": "Customer's company",
    "customer_type": "prospect | existing_customer",
    "company_stage": "startup | smb | mid-market | enterprise | unknown",
    "team_size": "Number if mentioned",
    "current_solution": "What they use today (for prospects) or how they use your product (for existing)",
    "use_case": "Primary use case they're solving for",
    "tenure": "How long they've been a customer (if existing)",
    "timeline": "Urgency or timeline if mentioned",
    "budget_signals": "Any pricing/budget context"
  },
  "call_metadata": {
    "source": "gong | fathom | zoom | other",
    "call_type": "sales_demo | discovery | support | onboarding | qbr | renewal | check_in | training | other",
    "duration_minutes": null,
    "overall_sentiment": -1 to 1,
    "next_steps": "What was agreed or implied as next action"
  },
  "risk_assessment": {
    "customer_type": "prospect | existing_customer",
    "deal_risk": "high | medium | low | n/a",
    "deal_risk_reasons": ["reason 1", "reason 2"],
    "churn_risk": "high | medium | low | n/a",
    "churn_risk_reasons": ["reason 1", "reason 2"],
    "expansion_signal": "high | medium | low | none",
    "expansion_reasons": ["reason 1", "reason 2"]
  },
  "mappings": [
    {
      "theme_id": "uuid",
      "theme_name": "Theme Name",
      "sub_theme_id": "uuid",
      "sub_theme_name": "Sub-Theme Name",
      "signal_type": "feature_request | implicit_need | pain_point | deal_blocker | adoption_blocker | objection | competitive_intent | competitive_mention | expansion_signal | churn_signal | renewal_risk | price_sensitivity | positive_feedback | support_issue | onboarding_friction",
      "speaker": "Name of customer who said it",
      "verbatim_quote": "Exact quote, max 30 words",
      "interpreted_need": "What this reveals about underlying requirement",
      "business_context": "Why this matters to their business",
      "confidence_score": 0-100,
      "impact_score": 0-100,
      "sentiment": -1 to 1,
      "reasoning": "Brief explanation of mapping and scoring logic"
    }
  ],
  "unmapped_signals": [
    {
      "signal_type": "type",
      "speaker": "Name",
      "verbatim_quote": "quote",
      "interpreted_need": "interpretation",
      "business_context": "context",
      "suggested_theme_id": "suggested-uuid-format",
      "suggested_theme_name": "Suggested Theme",
      "suggested_sub_theme_id": "suggested-uuid-format",
      "suggested_sub_theme_name": "Suggested Sub-Theme",
      "impact_score": 0-100,
      "reasoning": "Why this needs a new theme"
    }
  ],
  "theme_summary": {
    "theme_id_here": {
      "theme_id": "uuid",
      "theme_name": "Theme Name",
      "mention_count": 0,
      "avg_confidence": 0-100,
      "avg_impact": 0-100,
      "avg_sentiment": -1 to 1,
      "signal_types": ["list of signal types found"],
      "top_signals": ["Brief summary of key signals"],
      "has_blocker": true/false
    }
  },
  "key_insights": {
    "blockers": ["Critical gaps — deal_blocker for prospects, adoption_blocker for existing"],
    "strongest_needs": ["Top 3 needs by impact score"],
    "competitive_threats": ["Competitors mentioned or implied"],
    "health_signals": {
      "positive": ["What's going well"],
      "negative": ["What's concerning"]
    },
    "product_feedback_for_pm": "2-3 sentence summary of what PM should know from this call"
  }
}

---

## SCORING GUIDELINES

Be rigorous and conservative:
- 90+ confidence requires near-verbatim alignment with theme definition
- 90+ impact requires explicit business consequence, blocking status, or repeated emphasis
- deal_blocker and adoption_blocker signals should almost always have impact 80+
- Reserve extreme sentiment scores for clear emotional language

**Context-aware scoring:**
- For PROSPECTS: Weight deal_blocker, objection, competitive_intent highest
- For EXISTING CUSTOMERS: Weight churn_signal, renewal_risk, adoption_blocker, expansion_signal highest

**Confirmation signals:**
- When your team says "we don't have that" → confirms blocker, impact 80+
- When customer says "let me compare competitors" → competitive_intent + churn/deal risk HIGH
- When customer says "we love this" or shares success → positive_feedback, sentiment 0.7+

False positives are costly. When in doubt, score lower and explain your reasoning.
'''


# ---------------------------------------------------------------------------
# Workspace + Credentials
# ---------------------------------------------------------------------------

def find_or_create_workspace_by_email(db: Session, email: str) -> Optional[UUID]:
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Create user with workspace
        print(f"⚠️  User {email} not found. Creating user and workspace...")

        workspace = Workspace(name=f"{email.split('@')[0]}'s Workspace")
        db.add(workspace)
        db.flush()

        user = User(
            email=email,
            first_name=email.split('@')[0].capitalize(),
            last_name="",
            hashed_password="dev-script-user",  # Placeholder - not for login
            workspace_id=workspace.id,
            role="owner"
        )
        db.add(user)
        db.commit()

        print(f"✅ Created user and workspace: {workspace.name}")
        print(f"⚠️  Note: You need to add Fathom credentials to this workspace")
        return workspace.id

    if not user.workspace_id:
        # Create workspace for existing user
        print(f"⚠️  User {email} has no workspace. Creating one...")

        workspace = Workspace(name=f"{user.first_name}'s Workspace")
        db.add(workspace)
        db.flush()

        user.workspace_id = workspace.id
        db.commit()

        print(f"✅ Created workspace: {workspace.name}")
        print(f"⚠️  Note: You need to add Fathom credentials to this workspace")
        return workspace.id

    return user.workspace_id


DEFAULT_FATHOM_API_KEY = "wZlF_fLCb7oPqrOPrtnv6Q._m_8bMW1XGCGk-ypfQI-aSnB8-FJgWNxKmFDt5zUF8o"


def get_fathom_credentials(db: Session, workspace_id: UUID) -> Optional[str]:
    connector = db.query(WorkspaceConnector).filter(
        and_(
            WorkspaceConnector.workspace_id == workspace_id,
            WorkspaceConnector.connector_type == "fathom",
            WorkspaceConnector.is_active == True
        )
    ).first()

    if not connector:
        # Create Fathom connector with default API key
        print("⚠️  No Fathom connector found. Creating one...")

        connector = WorkspaceConnector(
            workspace_id=workspace_id,
            connector_type="fathom",
            name="Fathom Integration",
            credentials={"api_key": DEFAULT_FATHOM_API_KEY},
            is_active=True,
            sync_status="pending"
        )
        db.add(connector)
        db.commit()

        print(f"✅ Created Fathom connector with default API key")
        return DEFAULT_FATHOM_API_KEY

    if not connector.credentials:
        # Update existing connector with default API key
        connector.credentials = {"api_key": DEFAULT_FATHOM_API_KEY}
        db.commit()
        print(f"✅ Updated Fathom connector with default API key")
        return DEFAULT_FATHOM_API_KEY

    api_key = connector.credentials.get("api_key")
    if not api_key:
        connector.credentials["api_key"] = DEFAULT_FATHOM_API_KEY
        db.commit()
        print(f"✅ Added API key to Fathom connector")
        return DEFAULT_FATHOM_API_KEY

    print(f"✅ Found Fathom connector: {connector.name or connector.external_name}")
    return api_key


# ---------------------------------------------------------------------------
# Fathom API
# ---------------------------------------------------------------------------

def fetch_fathom_meetings(api_key: str, limit: int = 5) -> List[Dict[str, Any]]:
    url = f"{FATHOM_API_BASE}/external/v1/meetings"
    headers = {
        "X-Api-Key": api_key,
        "Content-Type": "application/json"
    }
    params = {
        "limit": limit,
        "include_transcript": "true"
    }

    response = requests.get(url, headers=headers, params=params, timeout=30)
    response.raise_for_status()

    # Fathom API returns meetings in 'items' array
    meetings = response.json().get("items", [])

    print(f"📞 Found {len(meetings)} meetings")
    return meetings


def fetch_fathom_transcript(api_key: str, meeting_id: str) -> Optional[Dict[str, Any]]:
    # Try the REST API endpoint for transcripts
    url = f"{FATHOM_API_BASE}/rest/v1/videos/{meeting_id}/transcript"
    headers = {
        "X-Api-Key": api_key,
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=60)
        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"   ⚠️  Could not fetch transcript: {e}")
        return None


# ---------------------------------------------------------------------------
# AI Analysis Functions (from Gong script)
# ---------------------------------------------------------------------------

def load_themes_json(file_path: str = "themes.json") -> Optional[List[Dict[str, Any]]]:
    """Load themes from JSON file or use built-in HIVER_THEMES."""
    possible_paths = [
        file_path,
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), file_path),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), file_path),
    ]

    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    themes = json.load(f)
                    print(f"✅ Loaded themes from: {path}")
                    return themes
            except Exception as e:
                print(f"⚠️  Error loading themes from {path}: {e}")

    # Fall back to built-in HIVER_THEMES
    print(f"✅ Using built-in HIVER_THEMES ({len(HIVER_THEMES)} themes)")
    return HIVER_THEMES


def get_langfuse_client():
    """Get Langfuse client."""
    try:
        from langfuse import Langfuse

        if not settings.LANGFUSE_SECRET_KEY or not settings.LANGFUSE_PUBLIC_KEY:
            print("❌ Langfuse credentials not configured")
            return None

        client = Langfuse(
            secret_key=settings.LANGFUSE_SECRET_KEY,
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            host=settings.LANGFUSE_HOST,
        )
        return client
    except Exception as e:
        print(f"❌ Failed to initialize Langfuse client: {e}")
        return None


def get_or_create_dataset(client, dataset_name: str = "transcripts"):
    """Get or create a Langfuse dataset."""
    try:
        try:
            datasets = client.get_datasets()
            dataset_list = datasets.data if hasattr(datasets, 'data') else datasets
            for dataset in dataset_list:
                if hasattr(dataset, 'name') and dataset.name == dataset_name:
                    print(f"✅ Using existing dataset: {dataset_name}")
                    return dataset
        except Exception as e:
            print(f"   ⚠️  Could not list datasets: {e}, will try to create")

        dataset = client.create_dataset(name=dataset_name)
        print(f"✅ Created new dataset: {dataset_name}")
        return dataset
    except Exception as e:
        print(f"❌ Failed to get/create dataset: {e}")
        return None


def process_transcript_with_prompt(
    transcript_text: str,
    themes_json: Optional[List[Dict[str, Any]]]
) -> Optional[Dict[str, Any]]:
    """Process transcript using local CLASSIFICATION_PROMPT and OpenAI."""
    try:
        from openai import OpenAI

        if not settings.OPENAI_API_KEY:
            print("   ⚠️  OPENAI_API_KEY not configured, skipping AI processing")
            return None

        # Build the prompt from local template
        themes_str = json.dumps(themes_json, indent=2) if themes_json else "[]"
        prompt_content = CLASSIFICATION_PROMPT.replace("{{THEMES_JSON}}", themes_str)
        prompt_content = prompt_content.replace("{{TRANSCRIPT}}", transcript_text)

        print(f"   📋 Using local CLASSIFICATION_PROMPT")
        print(f"   🔍 Prompt length: {len(prompt_content)} chars")
        print(f"   🔍 Transcript length: {len(transcript_text)} chars")

        messages = [{"role": "user", "content": prompt_content}]

        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

        print(f"   🤖 Calling OpenAI gpt-4o-mini...")
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0,
            response_format={"type": "json_object"},
            max_tokens=8000
        )

        result = json.loads(response.choices[0].message.content)
        print(f"   ✅ AI response received ({len(response.choices[0].message.content)} chars)")
        return result

    except Exception as e:
        print(f"   ⚠️  Error processing transcript with AI: {e}")
        import traceback
        traceback.print_exc()
        return None


def save_classification_to_db(
    db: Session,
    workspace_id: UUID,
    meeting: Dict[str, Any],
    ai_result: Optional[Dict[str, Any]],
    processing_status: str = "completed"
) -> bool:
    """Save transcript classification to database."""
    try:
        meeting_id = meeting.get("id") or meeting.get("recording_id") or "unknown"
        title = meeting.get("title") or meeting.get("meeting_title", "Untitled Meeting")
        started = meeting.get("started_at") or meeting.get("created_at", "")

        transcript_date = None
        if started:
            try:
                from dateutil import parser as date_parser
                transcript_date = date_parser.parse(started)
            except Exception:
                pass

        theme_id = None
        sub_theme_id = None

        if ai_result:
            mappings = ai_result.get('mappings', [])
            if isinstance(mappings, list) and len(mappings) > 0:
                first_mapping = mappings[0]
                if isinstance(first_mapping, dict):
                    theme_id_str = first_mapping.get('theme_id')
                    sub_theme_id_str = first_mapping.get('sub_theme_id')

                    if theme_id_str:
                        try:
                            theme_id = UUID(theme_id_str)
                            theme = db.query(Theme).filter(
                                Theme.id == theme_id,
                                Theme.workspace_id == workspace_id
                            ).first()
                            if not theme:
                                theme_id = None
                        except (ValueError, TypeError):
                            theme_id = None

                    if sub_theme_id_str:
                        try:
                            sub_theme_id = UUID(sub_theme_id_str)
                            sub_theme = db.query(SubTheme).filter(
                                SubTheme.id == sub_theme_id,
                                SubTheme.workspace_id == workspace_id
                            ).first()
                            if not sub_theme:
                                sub_theme_id = None
                        except (ValueError, TypeError):
                            sub_theme_id = None

            if not theme_id or not sub_theme_id:
                classification = ai_result.get('classification', {}) or ai_result.get('themes', {})

                if isinstance(classification, dict):
                    theme_name = classification.get('theme_name') or classification.get('theme')
                    sub_theme_name = classification.get('sub_theme_name') or classification.get('sub_theme')

                    if theme_name and not theme_id:
                        theme = db.query(Theme).filter(
                            Theme.workspace_id == workspace_id,
                            Theme.name.ilike(f"%{theme_name}%")
                        ).first()
                        if theme:
                            theme_id = theme.id

                    if sub_theme_name and theme_id and not sub_theme_id:
                        sub_theme = db.query(SubTheme).filter(
                            SubTheme.workspace_id == workspace_id,
                            SubTheme.theme_id == theme_id,
                            SubTheme.name.ilike(f"%{sub_theme_name}%")
                        ).first()
                        if sub_theme:
                            sub_theme_id = sub_theme.id

        extracted_data = ai_result if ai_result else {}

        theme_ids_list = []
        sub_theme_ids_list = []

        if ai_result:
            mappings = ai_result.get('mappings', [])
            if isinstance(mappings, list):
                for mapping in mappings:
                    if isinstance(mapping, dict):
                        theme_id_str = mapping.get('theme_id')
                        if theme_id_str:
                            try:
                                theme_uuid = UUID(theme_id_str)
                                theme = db.query(Theme).filter(
                                    Theme.id == theme_uuid,
                                    Theme.workspace_id == workspace_id
                                ).first()
                                if theme and theme_uuid not in theme_ids_list:
                                    theme_ids_list.append(theme_uuid)
                            except (ValueError, TypeError):
                                pass

                        sub_theme_id_str = mapping.get('sub_theme_id')
                        if sub_theme_id_str:
                            try:
                                sub_theme_uuid = UUID(sub_theme_id_str)
                                sub_theme = db.query(SubTheme).filter(
                                    SubTheme.id == sub_theme_uuid,
                                    SubTheme.workspace_id == workspace_id
                                ).first()
                                if sub_theme and sub_theme_uuid not in sub_theme_ids_list:
                                    sub_theme_ids_list.append(sub_theme_uuid)
                            except (ValueError, TypeError):
                                pass

        existing = db.query(TranscriptClassification).filter(
            TranscriptClassification.workspace_id == workspace_id,
            TranscriptClassification.source_type == "fathom",
            TranscriptClassification.source_id == str(meeting_id)
        ).first()

        if existing:
            existing.extracted_data = extracted_data
            existing.source_title = title
            existing.theme_id = theme_id
            existing.sub_theme_id = sub_theme_id
            existing.theme_ids = theme_ids_list if theme_ids_list else None
            existing.sub_theme_ids = sub_theme_ids_list if sub_theme_ids_list else None
            existing.processing_status = processing_status
            existing.transcript_date = transcript_date
            existing.updated_at = datetime.now(timezone.utc)
            if ai_result:
                existing.raw_ai_response = ai_result
        else:
            classification = TranscriptClassification(
                workspace_id=workspace_id,
                source_type="fathom",
                source_id=str(meeting_id),
                source_title=title,
                theme_id=theme_id,
                sub_theme_id=sub_theme_id,
                theme_ids=theme_ids_list if theme_ids_list else None,
                sub_theme_ids=sub_theme_ids_list if sub_theme_ids_list else None,
                extracted_data=extracted_data,
                raw_ai_response=ai_result,
                processing_status=processing_status,
                transcript_date=transcript_date
            )
            db.add(classification)

        db.commit()
        return True

    except Exception as e:
        print(f"   ⚠️  Error saving classification to database: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False


def store_in_langfuse_dataset(
    client,
    dataset,
    meeting: Dict[str, Any],
    transcript_text: str,
    ai_result: Optional[Dict[str, Any]]
) -> bool:
    """Store transcript in Langfuse dataset."""
    try:
        meeting_id = meeting.get("id") or meeting.get("recording_id") or "unknown"

        input_data = {
            "meeting_id": meeting_id,
            "title": meeting.get("title") or meeting.get("meeting_title", "Untitled Meeting"),
            "started_at": meeting.get("started_at") or meeting.get("created_at", ""),
            "transcript": transcript_text[:10000],
        }

        expected_output = ai_result if ai_result else {"status": "not_processed"}

        try:
            if hasattr(dataset, 'create_item'):
                dataset.create_item(
                    input=input_data,
                    expected_output=expected_output
                )
            elif hasattr(client, 'create_dataset_item'):
                client.create_dataset_item(
                    dataset_name=dataset.name if hasattr(dataset, 'name') else "transcripts",
                    input=input_data,
                    expected_output=expected_output
                )
            else:
                dataset_id = dataset.id if hasattr(dataset, 'id') else None
                if dataset_id:
                    client.create_dataset_item(
                        dataset_id=dataset_id,
                        input=input_data,
                        expected_output=expected_output
                    )
                else:
                    raise ValueError("Could not determine dataset ID or name")

            return True
        except AttributeError as e:
            print(f"   ⚠️  Dataset API method not found: {e}")
            return False

    except Exception as e:
        print(f"   ⚠️  Error storing in dataset: {e}")
        import traceback
        traceback.print_exc()
        return False


# ---------------------------------------------------------------------------
# Save AI Results to File
# ---------------------------------------------------------------------------

def save_ai_result_to_file(
    meeting: Dict[str, Any],
    ai_result: Dict[str, Any],
    output_dir: str,
    index: int
) -> str:
    """Save AI classification result to a JSON file."""
    os.makedirs(output_dir, exist_ok=True)

    meeting_id = meeting.get("id") or meeting.get("recording_id") or "unknown"
    title = meeting.get("title") or meeting.get("meeting_title", "Untitled Meeting")
    started = meeting.get("started_at") or meeting.get("created_at", "")

    safe_title = "".join(c for c in title if c.isalnum() or c in (" ", "-", "_"))
    safe_title = safe_title.replace(" ", "_")[:50]

    # Create filename for AI result
    result_filename = f"{index:02d}_{meeting_id}_{safe_title}_analysis.json"
    result_path = os.path.join(output_dir, result_filename)

    # Build output payload
    output_data = {
        "meeting_id": str(meeting_id),
        "title": title,
        "started_at": started,
        "source": "fathom",
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "ai_result": ai_result
    }

    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False, default=str)

    return result_path


# ---------------------------------------------------------------------------
# Formatting + Saving
# ---------------------------------------------------------------------------

def format_transcript_as_text(transcript_data: Any) -> str:
    """Format Fathom transcript as readable text.

    Fathom transcript structure (from meeting object):
    [
        {
            "speaker": {"display_name": "Name", "matched_calendar_invitee_email": "email"},
            "text": "...",
            "timestamp": "00:00:08"
        },
        ...
    ]

    Or from separate API (utterances format):
    {"utterances": [{"speaker": "Name", "text": "..."}]}
    """
    lines = []

    # Handle list format (from meeting.transcript)
    if isinstance(transcript_data, list):
        for entry in transcript_data:
            speaker_info = entry.get("speaker", {})
            if isinstance(speaker_info, dict):
                speaker = speaker_info.get("display_name", "Unknown")
            else:
                speaker = str(speaker_info) if speaker_info else "Unknown"

            text = entry.get("text", "").strip()
            timestamp = entry.get("timestamp", "")

            if text:
                if timestamp:
                    lines.append(f"[{timestamp}] {speaker}:")
                else:
                    lines.append(f"{speaker}:")
                lines.append(f"  {text}")
                lines.append("")
        return "\n".join(lines)

    # Handle dict format (from separate API with utterances)
    if isinstance(transcript_data, dict):
        utterances = transcript_data.get("utterances", [])
        if utterances:
            for u in utterances:
                speaker = u.get("speaker", "Unknown")
                if isinstance(speaker, dict):
                    speaker = speaker.get("display_name", "Unknown")
                text = u.get("text", "").strip()
                if text:
                    lines.append(f"{speaker}:")
                    lines.append(f"  {text}")
                    lines.append("")
            return "\n".join(lines)

        # Maybe transcript is directly in the dict as a list
        transcript_list = transcript_data.get("transcript", [])
        if isinstance(transcript_list, list):
            return format_transcript_as_text(transcript_list)

    return ""


def save_transcript(
    meeting: Dict[str, Any],
    transcript: Any,
    output_dir: str,
    index: int
) -> None:
    os.makedirs(output_dir, exist_ok=True)

    meeting_id = meeting.get("id") or meeting.get("recording_id")
    title = meeting.get("title") or meeting.get("meeting_title", "Untitled Meeting")
    started = meeting.get("started_at") or meeting.get("created_at")

    safe_title = "".join(c for c in title if c.isalnum() or c in (" ", "-", "_"))
    safe_title = safe_title.replace(" ", "_")[:50]

    json_path = os.path.join(
        output_dir,
        f"{index:02d}_{meeting_id}_{safe_title}.json"
    )

    txt_path = os.path.join(
        output_dir,
        f"{index:02d}_{meeting_id}_{safe_title}.txt"
    )

    # Check if transcript exists (handles both list and dict formats)
    has_transcript = bool(transcript) and (
        (isinstance(transcript, list) and len(transcript) > 0) or
        (isinstance(transcript, dict) and transcript)
    )

    payload = {
        "meeting_id": meeting_id,
        "title": title,
        "started_at": started,
        "meeting": meeting,
        "transcript": transcript,
        "has_transcript": has_transcript
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False, default=str)

    if has_transcript:
        text = format_transcript_as_text(transcript)
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)

        print(f"   💾 Saved JSON + TXT for: {title}")
    else:
        print(f"   💾 Saved JSON (no transcript): {title}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Fetch Fathom Transcripts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Fetch 5 transcripts for user by email
  python scripts/fetch_fathom_transcript.py --email user@company.com --limit 5

  # Fetch with custom output directory
  python scripts/fetch_fathom_transcript.py --email user@company.com --limit 5 --output-dir ./fathom_transcripts

  # Process with AI classification (saves *_analysis.json files)
  python scripts/fetch_fathom_transcript.py --email user@company.com --limit 5 --use-langfuse

  # Force re-processing of already analyzed meetings
  python scripts/fetch_fathom_transcript.py --email user@company.com --limit 10 --use-langfuse --force
        """
    )

    parser.add_argument("--email", type=str, help="User email")
    parser.add_argument("--workspace-id", type=str, help="Workspace ID")
    parser.add_argument("--limit", type=int, default=5, help="Number of transcripts")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./fathom_transcripts",
        help="Output directory"
    )
    parser.add_argument(
        "--use-langfuse",
        action="store_true",
        help="Process transcripts with AI classification and save results to files"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-processing (ignore existing analysis files)"
    )

    args = parser.parse_args()

    if not args.email and not args.workspace_id:
        print("❌ Either --email or --workspace-id is required")
        sys.exit(1)

    with SessionLocal() as db:
        if args.workspace_id:
            workspace_id = UUID(args.workspace_id)
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                print("❌ Workspace not found")
                sys.exit(1)
            print(f"✅ Using workspace: {workspace.name} ({workspace_id})")
        else:
            workspace_id = find_or_create_workspace_by_email(db, args.email)
            if not workspace_id:
                sys.exit(1)

        api_key = get_fathom_credentials(db, workspace_id)
        if not api_key:
            sys.exit(1)

        meetings = fetch_fathom_meetings(api_key, limit=args.limit)
        if not meetings:
            print("❌ No meetings found")
            sys.exit(0)

        # Load themes for AI classification
        themes_json = None
        if args.use_langfuse:
            print(f"\n📚 Loading themes...")
            themes_json = load_themes_json()

        print(f"\n📝 Fetching transcripts for {len(meetings)} meetings...\n")

        processed_count = 0
        saved_count = 0
        skipped_count = 0

        for i, meeting in enumerate(meetings, 1):
            meeting_id = meeting.get("id") or meeting.get("recording_id")
            title = meeting.get("title") or meeting.get("meeting_title", "Untitled")

            print(f"\n[{i}/{len(meetings)}] {title}")
            print(f"   Meeting ID: {meeting_id}")

            # Check if this meeting has already been processed (unless --force is used)
            if args.use_langfuse and not args.force:
                existing = db.query(TranscriptClassification).filter(
                    TranscriptClassification.workspace_id == workspace_id,
                    TranscriptClassification.source_type == "fathom",
                    TranscriptClassification.source_id == str(meeting_id)
                ).first()

                if existing and existing.processing_status == "completed":
                    skipped_count += 1
                    print(f"   ⏭️  Already processed (status: {existing.processing_status}), skipping AI processing...")
                    print(f"      Use --force to re-process this meeting")
                    # Still save files if they don't exist, but skip AI processing
                    transcript = fetch_fathom_transcript(api_key, meeting_id)
                    if not transcript:
                        transcript = meeting.get("transcript", [])
                    save_transcript(
                        meeting=meeting,
                        transcript=transcript,
                        output_dir=args.output_dir,
                        index=i
                    )
                    continue

            transcript = fetch_fathom_transcript(api_key, meeting_id)

            # If separate API call returns null, use transcript from meeting object
            if not transcript:
                meeting_transcript = meeting.get("transcript", [])
                if meeting_transcript:
                    transcript = meeting_transcript
                    print(f"   ✅ Using transcript from meeting object ({len(meeting_transcript)} entries)")
                else:
                    print(f"   ⚠️  No transcript available")
            else:
                print(f"   ✅ Transcript fetched from API")

            # Process with AI if enabled
            ai_result = None
            formatted_transcript = ""
            if args.use_langfuse and transcript:
                print(f"   🤖 Processing with AI classification...")
                formatted_transcript = format_transcript_as_text(transcript)
                if formatted_transcript:
                    ai_result = process_transcript_with_prompt(
                        formatted_transcript,
                        themes_json
                    )
                    if ai_result:
                        processed_count += 1
                        print(f"   ✅ AI processing complete")
                    else:
                        print(f"   ⚠️  AI processing failed or skipped")
                else:
                    print(f"   ⚠️  No transcript text to process")

            # Save AI result to file if processing was done
            if ai_result:
                print(f"   💾 Saving AI result to file...")
                result_path = save_ai_result_to_file(
                    meeting=meeting,
                    ai_result=ai_result,
                    output_dir=args.output_dir,
                    index=i
                )
                saved_count += 1
                print(f"   ✅ Saved to: {os.path.basename(result_path)}")

            save_transcript(
                meeting=meeting,
                transcript=transcript,
                output_dir=args.output_dir,
                index=i
            )

        print(f"\n✅ Done. Files saved to {os.path.abspath(args.output_dir)}")
        print(f"\n📊 Summary:")
        print(f"   Meetings fetched: {len(meetings)}")
        if args.use_langfuse:
            print(f"   Already processed (skipped): {skipped_count}/{len(meetings)}")
            print(f"   AI processed: {processed_count}/{len(meetings)}")
            print(f"   AI results saved: {saved_count}/{len(meetings)}")
        print(f"   Output directory: {os.path.abspath(args.output_dir)}")


if __name__ == "__main__":
    main()

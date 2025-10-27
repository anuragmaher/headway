"""
Workspace management service for connector operations
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from uuid import UUID
import logging
from typing import List, Optional, Union

from app.models.workspace_connector import WorkspaceConnector, ConnectorType
from app.models.workspace import Workspace
from app.models.company import Company
from app.schemas.workspace_connector import (
    WorkspaceConnectorResponse,
    GongConnectorCreate,
    FathomConnectorCreate,
    WorkspaceConnectorUpdate
)
from app.schemas.company import CompanyUpdate
import requests
import openai

logger = logging.getLogger(__name__)


class WorkspaceService:
    """Service class for workspace operations"""

    def __init__(self, db: Session):
        self.db = db

    def save_connector(
        self,
        workspace_id: UUID,
        connector_data: Union[GongConnectorCreate, FathomConnectorCreate]
    ) -> WorkspaceConnectorResponse:
        """
        Save or update a workspace connector.

        Args:
            workspace_id: UUID of the workspace
            connector_data: Connector creation data (Gong or Fathom)

        Returns:
            WorkspaceConnectorResponse with masked credentials

        Raises:
            HTTPException: If workspace doesn't exist or validation fails
        """
        # Verify workspace exists
        workspace = self.db.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        # Check if connector of this type already exists
        existing_connector = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace_id,
            WorkspaceConnector.connector_type == connector_data.connector_type
        ).first()

        try:
            if existing_connector:
                # Update existing connector
                logger.info(f"Updating connector {existing_connector.id} for workspace {workspace_id}")

                if connector_data.connector_type == "gong":
                    existing_connector.credentials = {
                        "access_key": connector_data.gong_access_key,
                        "secret_key": connector_data.gong_secret_key
                    }
                elif connector_data.connector_type == "fathom":
                    existing_connector.credentials = {
                        "api_token": connector_data.fathom_api_token
                    }

                existing_connector.is_active = True
                self.db.commit()
                self.db.refresh(existing_connector)

                response = WorkspaceConnectorResponse.from_orm(existing_connector)
            else:
                # Create new connector
                logger.info(f"Creating new {connector_data.connector_type} connector for workspace {workspace_id}")

                # Prepare credentials based on type
                credentials = {}
                if connector_data.connector_type == "gong":
                    credentials = {
                        "access_key": connector_data.gong_access_key,
                        "secret_key": connector_data.gong_secret_key
                    }
                elif connector_data.connector_type == "fathom":
                    credentials = {
                        "api_token": connector_data.fathom_api_token
                    }

                new_connector = WorkspaceConnector(
                    workspace_id=workspace_id,
                    connector_type=connector_data.connector_type,
                    credentials=credentials,
                    is_active=True
                )

                self.db.add(new_connector)
                self.db.commit()
                self.db.refresh(new_connector)

                response = WorkspaceConnectorResponse.from_orm(new_connector)

            # Mask credentials before returning
            return response.mask_credentials()

        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database error creating connector: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to save connector. Please verify your data."
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Unexpected error saving connector: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

    def get_connectors(self, workspace_id: UUID) -> List[WorkspaceConnectorResponse]:
        """
        Get all connectors for a workspace.

        Args:
            workspace_id: UUID of the workspace

        Returns:
            List of WorkspaceConnectorResponse with masked credentials

        Raises:
            HTTPException: If workspace doesn't exist
        """
        # Verify workspace exists
        workspace = self.db.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        connectors = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace_id
        ).all()

        return [
            WorkspaceConnectorResponse.from_orm(c).mask_credentials()
            for c in connectors
        ]

    def get_connector_by_type(
        self,
        workspace_id: UUID,
        connector_type: str
    ) -> Optional[WorkspaceConnector]:
        """
        Get a specific connector by type (used by ingestion scripts).

        Args:
            workspace_id: UUID of the workspace
            connector_type: Type of connector ('gong' or 'fathom')

        Returns:
            WorkspaceConnector with full credentials, or None if not found

        Note: This method returns full credentials (not masked) for use by ingestion scripts
        """
        return self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.workspace_id == workspace_id,
            WorkspaceConnector.connector_type == connector_type,
            WorkspaceConnector.is_active == True
        ).first()

    def update_connector(
        self,
        workspace_id: UUID,
        connector_id: UUID,
        connector_data: WorkspaceConnectorUpdate
    ) -> WorkspaceConnectorResponse:
        """
        Update a specific connector's credentials.

        Args:
            workspace_id: UUID of the workspace
            connector_id: UUID of the connector
            connector_data: Update data with optional credentials

        Returns:
            Updated WorkspaceConnectorResponse with masked credentials

        Raises:
            HTTPException: If connector not found or validation fails
        """
        connector = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.id == connector_id,
            WorkspaceConnector.workspace_id == workspace_id
        ).first()

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connector not found"
            )

        try:
            # Update credentials from request
            updated_creds = connector.credentials or {}

            if connector_data.gong_access_key is not None:
                updated_creds["access_key"] = connector_data.gong_access_key
            if connector_data.gong_secret_key is not None:
                updated_creds["secret_key"] = connector_data.gong_secret_key
            if connector_data.fathom_api_token is not None:
                updated_creds["api_token"] = connector_data.fathom_api_token

            connector.credentials = updated_creds
            self.db.commit()
            self.db.refresh(connector)

            response = WorkspaceConnectorResponse.from_orm(connector)
            return response.mask_credentials()

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating connector: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update connector"
            )

    def delete_connector(
        self,
        workspace_id: UUID,
        connector_id: UUID
    ) -> dict:
        """
        Delete a connector from a workspace.

        Args:
            workspace_id: UUID of the workspace
            connector_id: UUID of the connector

        Returns:
            Success message

        Raises:
            HTTPException: If connector not found
        """
        connector = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.id == connector_id,
            WorkspaceConnector.workspace_id == workspace_id
        ).first()

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connector not found"
            )

        try:
            logger.info(f"Deleting connector {connector_id} from workspace {workspace_id}")
            self.db.delete(connector)
            self.db.commit()

            return {"message": "Connector deleted successfully"}

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting connector: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete connector"
            )

    def update_company_details(
        self,
        workspace_id: UUID,
        company_data: CompanyUpdate
    ) -> dict:
        """
        Update company details for a workspace.

        Args:
            workspace_id: UUID of the workspace
            company_data: Company update data

        Returns:
            Updated company data

        Raises:
            HTTPException: If workspace or company not found
        """
        # Get workspace and its associated company
        workspace = self.db.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()

        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found"
            )

        company = self.db.query(Company).filter(
            Company.id == workspace.company_id
        ).first()

        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found"
            )

        try:
            # Update company fields
            if company_data.name is not None:
                company.name = company_data.name
            if company_data.website is not None:
                company.website = company_data.website
            if company_data.size is not None:
                company.size = company_data.size
            if company_data.description is not None:
                company.description = company_data.description
            if company_data.industry is not None:
                company.industry = company_data.industry

            self.db.commit()
            self.db.refresh(company)

            return {
                "id": str(company.id),
                "name": company.name,
                "website": company.website,
                "size": company.size,
                "description": company.description,
                "industry": company.industry
            }

        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database error updating company: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update company details"
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating company details: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update company details"
            )

    def generate_description_from_website(
        self,
        workspace_id: UUID,
        website_url: str
    ) -> dict:
        """
        Fetch website content using Firecrawl and generate description using OpenAI.

        Args:
            workspace_id: UUID of the workspace
            website_url: URL of the company website

        Returns:
            Dictionary with generated description

        Raises:
            HTTPException: If website fetch fails or OpenAI call fails
        """
        try:
            logger.info(f"Fetching website content from {website_url} using Firecrawl")

            # Validate workspace exists
            workspace = self.db.query(Workspace).filter(
                Workspace.id == workspace_id
            ).first()

            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )

            # Fetch website content using Firecrawl
            from app.core.config import settings
            from firecrawl import FirecrawlApp

            if not settings.FIRECRAWL_API_KEY:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Firecrawl API key not configured"
                )

            app = FirecrawlApp(api_key=settings.FIRECRAWL_API_KEY)
            # Use simple scraping with minimal params
            scrape_result = app.scrape_url(website_url)

            # Handle ScrapeResponse object
            if not scrape_result:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to fetch website content"
                )

            # Access the markdown content from the response object
            website_text = getattr(scrape_result, 'markdown', '') or getattr(scrape_result, 'content', '')

            if not website_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not extract content from website"
                )

            # Limit text to 3000 chars for API efficiency
            website_text = website_text[:3000]

            logger.info(f"Extracted website text: {len(website_text)} characters")

            # Generate description using OpenAI
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that creates concise company descriptions. Generate a 2-3 sentence description of what the company does based on the provided website content."
                    },
                    {
                        "role": "user",
                        "content": f"Based on this website content, provide a concise company description:\n\n{website_text}"
                    }
                ],
                max_tokens=150,
                temperature=0.7
            )

            description = response.choices[0].message.content.strip()

            logger.info(f"Generated description: {description}")

            return {
                "description": description,
                "status": "success"
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error generating description: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate description: {str(e)}"
            )

    def generate_theme_suggestions(
        self,
        workspace_id: UUID,
        already_suggested: list = None
    ) -> dict:
        """
        Generate AI-powered theme suggestions based on company details.

        Args:
            workspace_id: UUID of the workspace
            already_suggested: List of already-suggested themes to avoid in format [{"name": "...", "description": "..."}, ...]

        Returns:
            Dictionary with list of theme suggestions containing name and description

        Raises:
            HTTPException: If company details not found or generation fails
        """
        try:
            if already_suggested is None:
                already_suggested = []

            logger.info(f"Generating theme suggestions for workspace {workspace_id}. Already suggested: {len(already_suggested)}")

            # Get workspace and its company details
            workspace = self.db.query(Workspace).filter(
                Workspace.id == workspace_id
            ).first()

            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )

            company = self.db.query(Company).filter(
                Company.id == workspace.company_id
            ).first()

            if not company or not company.name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Company details not found. Please set up company details first."
                )

            # Build company context for AI
            company_context = f"""
Company Name: {company.name}
Industry: {company.industry or 'Not specified'}
Size: {company.size or 'Not specified'}
Website: {company.website or 'Not specified'}
Description: {company.description or 'Not specified'}
"""

            logger.info(f"Using company context: {company_context}")

            # Build list of already suggested themes for the prompt
            already_suggested_text = ""
            if already_suggested:
                theme_names = ", ".join([t.get("name", "") for t in already_suggested if t.get("name")])
                already_suggested_text = f"""

IMPORTANT: Do NOT suggest these themes again - user has already seen them:
- {theme_names}

Generate completely different themes that complement or expand on the existing ones."""

            # Generate suggestions using OpenAI
            from app.core.config import settings
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at categorizing customer feedback for SaaS products. Your task is to create theme categories that are highly specific to the company's business, products, and customer base. Themes should represent different aspects of customer feedback relevant to what the company does."
                    },
                    {
                        "role": "user",
                        "content": f"""Analyze this company and generate 5-6 theme suggestions for organizing their customer feedback:

{company_context}

Based on what this company does (from their description above), think about:
1. What are the main product areas or features customers would give feedback on?
2. What operational or business aspects would customers care about?
3. What customer pain points or experience categories are relevant?
4. What are common feedback categories for similar companies?

Generate themes that are SPECIFIC to this company's business and products, not generic.{already_suggested_text}

Return ONLY valid JSON array in this format, no markdown or extra text:
[
  {{"name": "Theme Name", "description": "What this theme captures for this specific company"}},
  ...
]"""
                    }
                ],
                max_tokens=600,
                temperature=0.7
            )

            suggestions_text = response.choices[0].message.content.strip()
            logger.info(f"Raw suggestions response: {suggestions_text}")

            # Parse JSON response
            import json
            # Remove markdown code blocks if present
            if suggestions_text.startswith("```"):
                suggestions_text = suggestions_text.split("```")[1]
                if suggestions_text.startswith("json"):
                    suggestions_text = suggestions_text[4:]
                suggestions_text = suggestions_text.strip()

            suggestions = json.loads(suggestions_text)

            # Validate and clean suggestions
            cleaned_suggestions = []
            for suggestion in suggestions:
                if isinstance(suggestion, dict) and 'name' in suggestion and 'description' in suggestion:
                    cleaned_suggestions.append({
                        'name': suggestion['name'],
                        'description': suggestion['description']
                    })

            logger.info(f"Generated {len(cleaned_suggestions)} theme suggestions")

            return {
                "suggestions": cleaned_suggestions,
                "status": "success"
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error generating theme suggestions: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate theme suggestions: {str(e)}"
            )

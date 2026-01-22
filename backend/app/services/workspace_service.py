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
from app.models.competitor import Competitor
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

                # Map credentials from JSONB to response fields
                credentials = existing_connector.credentials or {}
                if connector_data.connector_type == "gong":
                    response = WorkspaceConnectorResponse(
                        id=existing_connector.id,
                        workspace_id=existing_connector.workspace_id,
                        connector_type=existing_connector.connector_type,
                        is_active=existing_connector.is_active,
                        created_at=existing_connector.created_at,
                        updated_at=existing_connector.updated_at,
                        gong_access_key=credentials.get("access_key", ""),
                        gong_secret_key=credentials.get("secret_key", ""),
                        fathom_api_token=None
                    )
                else:  # fathom
                    response = WorkspaceConnectorResponse(
                        id=existing_connector.id,
                        workspace_id=existing_connector.workspace_id,
                        connector_type=existing_connector.connector_type,
                        is_active=existing_connector.is_active,
                        created_at=existing_connector.created_at,
                        updated_at=existing_connector.updated_at,
                        gong_access_key=None,
                        gong_secret_key=None,
                        fathom_api_token=credentials.get("api_token", "")
                    )
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

                # Map credentials from JSONB to response fields
                if connector_data.connector_type == "gong":
                    response = WorkspaceConnectorResponse(
                        id=new_connector.id,
                        workspace_id=new_connector.workspace_id,
                        connector_type=new_connector.connector_type,
                        is_active=new_connector.is_active,
                        created_at=new_connector.created_at,
                        updated_at=new_connector.updated_at,
                        gong_access_key=credentials.get("access_key", ""),
                        gong_secret_key=credentials.get("secret_key", ""),
                        fathom_api_token=None
                    )
                else:  # fathom
                    response = WorkspaceConnectorResponse(
                        id=new_connector.id,
                        workspace_id=new_connector.workspace_id,
                        connector_type=new_connector.connector_type,
                        is_active=new_connector.is_active,
                        created_at=new_connector.created_at,
                        updated_at=new_connector.updated_at,
                        gong_access_key=None,
                        gong_secret_key=None,
                        fathom_api_token=credentials.get("api_token", "")
                    )

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

    def get_connector(
        self, workspace_id: UUID, connector_id: UUID
    ) -> Optional[WorkspaceConnectorResponse]:
        """
        Get a specific connector by ID.

        Args:
            workspace_id: UUID of the workspace
            connector_id: UUID of the connector

        Returns:
            WorkspaceConnectorResponse with masked credentials, or None if not found
        """
        connector = self.db.query(WorkspaceConnector).filter(
            WorkspaceConnector.id == connector_id,
            WorkspaceConnector.workspace_id == workspace_id
        ).first()

        if not connector:
            return None

        # Extract credentials from JSONB column and map to response fields
        credentials = connector.credentials or {}
        
        if connector.connector_type == "gong":
            gong_access_key = credentials.get("access_key", "")
            gong_secret_key = credentials.get("secret_key", "")
            response = WorkspaceConnectorResponse(
                id=connector.id,
                workspace_id=connector.workspace_id,
                connector_type=connector.connector_type,
                is_active=connector.is_active,
                created_at=connector.created_at,
                updated_at=connector.updated_at,
                gong_access_key=gong_access_key,
                gong_secret_key=gong_secret_key,
                fathom_api_token=None
            )
        elif connector.connector_type == "fathom":
            fathom_api_token = credentials.get("api_token", "")
            response = WorkspaceConnectorResponse(
                id=connector.id,
                workspace_id=connector.workspace_id,
                connector_type=connector.connector_type,
                is_active=connector.is_active,
                created_at=connector.created_at,
                updated_at=connector.updated_at,
                gong_access_key=None,
                gong_secret_key=None,
                fathom_api_token=fathom_api_token
            )
        else:
            response = WorkspaceConnectorResponse(
                id=connector.id,
                workspace_id=connector.workspace_id,
                connector_type=connector.connector_type,
                is_active=connector.is_active,
                created_at=connector.created_at,
                updated_at=connector.updated_at,
                gong_access_key=None,
                gong_secret_key=None,
                fathom_api_token=None
            )

        # Don't mask credentials for details view - user needs to see what they entered
        # return response.mask_credentials()
        return response

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

        result = []
        for connector in connectors:
            credentials = connector.credentials or {}
            
            if connector.connector_type == "gong":
                response = WorkspaceConnectorResponse(
                    id=connector.id,
                    workspace_id=connector.workspace_id,
                    connector_type=connector.connector_type,
                    is_active=connector.is_active,
                    created_at=connector.created_at,
                    updated_at=connector.updated_at,
                    gong_access_key=credentials.get("access_key", ""),
                    gong_secret_key=credentials.get("secret_key", ""),
                    fathom_api_token=None
                )
            elif connector.connector_type == "fathom":
                response = WorkspaceConnectorResponse(
                    id=connector.id,
                    workspace_id=connector.workspace_id,
                    connector_type=connector.connector_type,
                    is_active=connector.is_active,
                    created_at=connector.created_at,
                    updated_at=connector.updated_at,
                    gong_access_key=None,
                    gong_secret_key=None,
                    fathom_api_token=credentials.get("api_token", "")
                )
            else:
                response = WorkspaceConnectorResponse(
                    id=connector.id,
                    workspace_id=connector.workspace_id,
                    connector_type=connector.connector_type,
                    is_active=connector.is_active,
                    created_at=connector.created_at,
                    updated_at=connector.updated_at,
                    gong_access_key=None,
                    gong_secret_key=None,
                    fathom_api_token=None
                )
            
            result.append(response.mask_credentials())
        
        return result

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
        Fetch website content and generate description using OpenAI.

        Args:
            workspace_id: UUID of the workspace
            website_url: URL of the company website

        Returns:
            Dictionary with generated description

        Raises:
            HTTPException: If website fetch fails or OpenAI call fails
        """
        import requests
        from bs4 import BeautifulSoup
        from app.core.config import settings

        try:
            logger.info(f"Fetching website content from {website_url}")

            # Validate workspace exists
            workspace = self.db.query(Workspace).filter(
                Workspace.id == workspace_id
            ).first()

            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )

            # Ensure URL has protocol
            if not website_url.startswith(('http://', 'https://')):
                website_url = 'https://' + website_url

            # Fetch website content using requests
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }

            try:
                response = requests.get(website_url, headers=headers, timeout=15, allow_redirects=True)
                response.raise_for_status()
            except requests.RequestException as e:
                logger.error(f"Failed to fetch website: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Could not fetch website: {str(e)}"
                )

            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(response.text, 'lxml')

            # Remove script and style elements
            for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript']):
                element.decompose()

            # Extract meaningful content
            content_parts = []

            # Get title
            if soup.title and soup.title.string:
                content_parts.append(f"Title: {soup.title.string.strip()}")

            # Get meta description
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                content_parts.append(f"Description: {meta_desc['content'].strip()}")

            # Get OG description
            og_desc = soup.find('meta', attrs={'property': 'og:description'})
            if og_desc and og_desc.get('content'):
                content_parts.append(f"About: {og_desc['content'].strip()}")

            # Get main headings
            headings = []
            for h in soup.find_all(['h1', 'h2'], limit=5):
                text = h.get_text(strip=True)
                if text and len(text) > 3:
                    headings.append(text)
            if headings:
                content_parts.append(f"Headlines: {', '.join(headings)}")

            # Get main content from common containers
            main_content = soup.find('main') or soup.find('article') or soup.find('div', class_=['content', 'main', 'hero'])
            if main_content:
                paragraphs = main_content.find_all('p', limit=5)
            else:
                paragraphs = soup.find_all('p', limit=8)

            para_texts = []
            for p in paragraphs:
                text = p.get_text(strip=True)
                if text and len(text) > 50:  # Only meaningful paragraphs
                    para_texts.append(text)

            if para_texts:
                content_parts.append(f"Content: {' '.join(para_texts[:3])}")

            website_text = '\n'.join(content_parts)

            if not website_text or len(website_text) < 50:
                # Fallback: get all text
                website_text = soup.get_text(separator=' ', strip=True)[:2000]

            # Limit text to 3000 chars for API efficiency
            website_text = website_text[:3000]

            logger.info(f"Extracted website text: {len(website_text)} characters")

            if not settings.OPENAI_API_KEY:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="OpenAI API key not configured"
                )

            # Generate description using OpenAI
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that creates concise company descriptions. Based on the website content provided, generate a 2-3 sentence description explaining what the company does, who they serve, and their main value proposition. Be specific and informative."
                    },
                    {
                        "role": "user",
                        "content": f"Based on this website content, provide a concise company description:\n\n{website_text}"
                    }
                ],
                max_tokens=200,
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
            logger.error(f"Error generating description: {e}", exc_info=True)
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

    def generate_competitor_suggestions(
        self,
        workspace_id: UUID,
        already_suggested: list = None
    ) -> dict:
        """
        Generate AI-powered competitor suggestions based on company details.

        Args:
            workspace_id: UUID of the workspace
            already_suggested: List of already-suggested competitor names to avoid

        Returns:
            Dictionary with list of competitor suggestions

        Raises:
            HTTPException: If company details not found or generation fails
        """
        try:
            if already_suggested is None:
                already_suggested = []

            logger.info(f"Generating competitor suggestions for workspace {workspace_id}. Already suggested: {len(already_suggested)}")

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
Website: {company.website or 'Not specified'}
Team Size: {company.size or 'Not specified'}
"""

            logger.info(f"Using company context for competitor suggestions: {company_context}")

            # Build list of already suggested competitors for the prompt
            already_suggested_text = ""
            if already_suggested:
                already_suggested_text = f"""

IMPORTANT: Do NOT suggest these competitors again - user has already seen them:
- {', '.join(already_suggested)}

Generate completely different competitor suggestions."""

            # Generate suggestions using OpenAI
            from app.core.config import settings
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert market analyst who identifies direct and indirect competitors in the SaaS/technology industry. You provide accurate competitor names based on company profiles."
                    },
                    {
                        "role": "user",
                        "content": f"""Analyze this company and identify 4-5 likely competitors:

{company_context}
{already_suggested_text}

Based on the company's industry, product description, and market positioning, identify their main competitors.
Consider both direct competitors (offering similar solutions) and indirect competitors (solving the same problem differently).

Return ONLY valid JSON array in this format, no markdown or extra text:
[
  {{"name": "Competitor Name", "website": "https://example.com", "description": "Brief description of what they do"}},
  ...
]"""
                    }
                ],
                max_tokens=500,
                temperature=0.7
            )

            suggestions_text = response.choices[0].message.content.strip()
            logger.info(f"Raw competitor suggestions response: {suggestions_text}")

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
                if isinstance(suggestion, dict) and 'name' in suggestion:
                    cleaned_suggestions.append({
                        'name': suggestion['name'],
                        'website': suggestion.get('website', ''),
                        'description': suggestion.get('description', '')
                    })

            logger.info(f"Generated {len(cleaned_suggestions)} competitor suggestions")

            return {
                "suggestions": cleaned_suggestions,
                "status": "success"
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error generating competitor suggestions: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate competitor suggestions: {str(e)}"
            )

    def get_competitors(
        self,
        workspace_id: UUID
    ) -> dict:
        """
        Get competitors for a workspace.

        Args:
            workspace_id: UUID of the workspace

        Returns:
            Dictionary with list of competitors

        Raises:
            HTTPException: If workspace not found or fetching fails
        """
        try:
            logger.info(f"Fetching competitors for workspace {workspace_id}")

            # Validate workspace exists
            workspace = self.db.query(Workspace).filter(
                Workspace.id == workspace_id
            ).first()

            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )

            # Get all competitors for this workspace
            competitors = self.db.query(Competitor).filter(
                Competitor.workspace_id == workspace_id
            ).order_by(Competitor.created_at.desc()).all()

            competitors_list = [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "website": c.website or "",
                    "description": c.description or ""
                }
                for c in competitors
            ]

            logger.info(f"Found {len(competitors_list)} competitors for workspace {workspace_id}")

            return {
                "status": "success",
                "competitors": competitors_list
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching competitors: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch competitors: {str(e)}"
            )

    def save_competitors(
        self,
        workspace_id: UUID,
        competitors: list
    ) -> dict:
        """
        Save competitors for a workspace.

        Args:
            workspace_id: UUID of the workspace
            competitors: List of competitors to save [{"name": "...", "website": "..."}, ...]

        Returns:
            Dictionary with success status and saved competitors

        Raises:
            HTTPException: If workspace not found or saving fails
        """
        try:
            logger.info(f"Saving {len(competitors)} competitors for workspace {workspace_id}")

            # Validate workspace exists
            workspace = self.db.query(Workspace).filter(
                Workspace.id == workspace_id
            ).first()

            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )

            # Get existing competitor names to avoid duplicates
            existing_competitors = self.db.query(Competitor).filter(
                Competitor.workspace_id == workspace_id
            ).all()
            existing_names = {c.name.lower() for c in existing_competitors}

            # Add new competitors (avoid duplicates)
            saved_count = 0
            for competitor_data in competitors:
                name = competitor_data.get('name', '').strip()
                if not name:
                    continue
                    
                if name.lower() not in existing_names:
                    new_competitor = Competitor(
                        workspace_id=workspace_id,
                        name=name,
                        website=competitor_data.get('website', ''),
                        description=competitor_data.get('description', '')
                    )
                    self.db.add(new_competitor)
                    existing_names.add(name.lower())
                    saved_count += 1

            self.db.commit()
            logger.info(f"Saved {saved_count} new competitors for workspace {workspace_id}")

            return {
                "status": "success",
                "message": f"Saved {saved_count} competitors",
                "saved_count": saved_count
            }

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error saving competitors: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save competitors: {str(e)}"
            )

    def update_competitor(
        self,
        workspace_id: UUID,
        competitor_id: UUID,
        competitor_data: dict
    ) -> dict:
        """
        Update a competitor for a workspace.

        Args:
            workspace_id: UUID of the workspace
            competitor_id: UUID of the competitor
            competitor_data: Dictionary with updated competitor data (name, website, description)

        Returns:
            Dictionary with success status

        Raises:
            HTTPException: If workspace or competitor not found or update fails
        """
        try:
            logger.info(f"Updating competitor {competitor_id} for workspace {workspace_id}")

            # Validate workspace exists
            workspace = self.db.query(Workspace).filter(
                Workspace.id == workspace_id
            ).first()

            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )

            # Get the competitor
            competitor = self.db.query(Competitor).filter(
                Competitor.id == competitor_id,
                Competitor.workspace_id == workspace_id
            ).first()

            if not competitor:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Competitor not found"
                )

            # Update competitor fields
            if 'name' in competitor_data:
                competitor.name = competitor_data.get('name', '').strip()
            if 'website' in competitor_data:
                competitor.website = competitor_data.get('website', '') or None
            if 'description' in competitor_data:
                competitor.description = competitor_data.get('description', '') or None

            self.db.commit()
            logger.info(f"Competitor {competitor_id} updated successfully for workspace {workspace_id}")

            return {
                "status": "success",
                "message": "Competitor updated successfully",
                "competitor": {
                    "id": str(competitor.id),
                    "name": competitor.name,
                    "website": competitor.website or "",
                    "description": competitor.description or ""
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating competitor: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update competitor: {str(e)}"
            )

    def delete_competitor(
        self,
        workspace_id: UUID,
        competitor_id: UUID
    ) -> dict:
        """
        Delete a competitor for a workspace.

        Args:
            workspace_id: UUID of the workspace
            competitor_id: UUID of the competitor

        Returns:
            Dictionary with success status

        Raises:
            HTTPException: If workspace or competitor not found or deletion fails
        """
        try:
            logger.info(f"Deleting competitor {competitor_id} for workspace {workspace_id}")

            # Validate workspace exists
            workspace = self.db.query(Workspace).filter(
                Workspace.id == workspace_id
            ).first()

            if not workspace:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found"
                )

            # Get the competitor
            competitor = self.db.query(Competitor).filter(
                Competitor.id == competitor_id,
                Competitor.workspace_id == workspace_id
            ).first()

            if not competitor:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Competitor not found"
                )

            # Delete the competitor
            self.db.delete(competitor)
            self.db.commit()
            logger.info(f"Competitor {competitor_id} deleted successfully for workspace {workspace_id}")

            return {
                "status": "success",
                "message": "Competitor deleted successfully"
            }

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting competitor: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete competitor: {str(e)}"
            )

    def generate_feature_suggestions(
        self,
        workspace_id: UUID,
        theme_name: str,
        existing_features: list = None,
        already_suggested: list = None
    ) -> dict:
        """
        Generate AI-powered feature suggestions based on company details and selected theme.

        Args:
            workspace_id: UUID of the workspace
            theme_name: Name of the selected theme
            existing_features: List of existing features in DB to avoid in format [{"name": "...", "description": "..."}, ...]
            already_suggested: List of already-suggested features to avoid in format [{"name": "...", "description": "..."}, ...]

        Returns:
            Dictionary with list of feature suggestions containing name and description

        Raises:
            HTTPException: If company details not found or generation fails
        """
        try:
            if existing_features is None:
                existing_features = []
            if already_suggested is None:
                already_suggested = []

            logger.info(f"Generating feature suggestions for workspace {workspace_id}, theme: {theme_name}. Existing: {len(existing_features)}, Already suggested: {len(already_suggested)}")

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

            logger.info(f"Using company context and theme: {theme_name}")

            # Build list of existing features in DB for the prompt
            existing_features_text = ""
            if existing_features:
                feature_names = ", ".join([f.get("name", "") for f in existing_features if f.get("name")])
                existing_features_text = f"""

IMPORTANT: These features ALREADY EXIST in the system - do NOT suggest them:
- {feature_names}
"""

            # Build list of already suggested features for the prompt
            already_suggested_text = ""
            if already_suggested:
                feature_names = ", ".join([f.get("name", "") for f in already_suggested if f.get("name")])
                already_suggested_text = f"""

IMPORTANT: Do NOT suggest these features again - user has already seen them in suggestions:
- {feature_names}

Generate completely different features that complement or expand on the existing ones."""

            # Generate suggestions using OpenAI
            from app.core.config import settings
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at identifying valuable feature requests for SaaS products. Your task is to generate realistic, specific feature ideas that customers would request based on the company's business, products, and customer needs. Features should be concrete and actionable."
                    },
                    {
                        "role": "user",
                        "content": f"""Generate 5-6 specific feature suggestions for the "{theme_name}" category based on this company:

{company_context}

For the "{theme_name}" theme, think about:
1. What specific features or improvements would customers request in this category?
2. What pain points or workflows exist in this area?
3. What competitive features do similar companies have?
4. What would make the product more valuable to customers?

Generate concrete, specific feature requests (not generic ones) that customers might actually submit.{existing_features_text}{already_suggested_text}

Return ONLY valid JSON array in this format, no markdown or extra text:
[
  {{"name": "Feature Name", "description": "What this feature does and why it matters"}},
  ...
]"""
                    }
                ],
                max_tokens=700,
                temperature=0.7
            )

            suggestions_text = response.choices[0].message.content.strip()
            logger.info(f"Raw feature suggestions response: {suggestions_text}")

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

            logger.info(f"Generated {len(cleaned_suggestions)} feature suggestions")

            return {
                "suggestions": cleaned_suggestions,
                "status": "success"
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error generating feature suggestions: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate feature suggestions: {str(e)}"
            )

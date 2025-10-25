#!/usr/bin/env python3
"""
Generic data ingestion script for HeadwayHQ

This script reads configured connectors for a workspace and dynamically invokes
the appropriate ingestion service based on connector type. Supports multiple
connector types (Gong, Fathom, etc.) without code changes.

Usage:
    # Ingest from all configured connectors in a workspace
    python -m app.scripts.ingest_from_connectors --workspace-id <uuid>

    # Ingest with specific limits
    python -m app.scripts.ingest_from_connectors --workspace-id <uuid> --limit 50 --days-back 7

    # Ingest only from specific connector type
    python -m app.scripts.ingest_from_connectors --workspace-id <uuid> --connector-type gong

    # Verbose output
    python -m app.scripts.ingest_from_connectors --workspace-id <uuid> --verbose
"""

import asyncio
import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from pathlib import Path
from sqlalchemy.orm import Session
from uuid import UUID

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db
from app.models.workspace import Workspace
from app.models.workspace_connector import WorkspaceConnector
from app.services.workspace_service import WorkspaceService
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ConnectorIngestionOrchestrator:
    """Orchestrates data ingestion from multiple connector types"""

    def __init__(self):
        """Initialize the orchestrator with connector-specific modules"""
        self.connector_handlers = {
            'gong': self._get_gong_handler(),
            'fathom': self._get_fathom_handler(),
        }

    def _get_gong_handler(self):
        """Get Gong ingestion handler"""
        from app.scripts.ingest_gong_calls import ingest_gong_calls
        return ingest_gong_calls

    def _get_fathom_handler(self):
        """Get Fathom ingestion handler"""
        from app.scripts.ingest_fathom_sessions import ingest_fathom_sessions
        return ingest_fathom_sessions

    async def ingest_from_workspace_connectors(
        self,
        workspace_id: str,
        connector_type: Optional[str] = None,
        limit: int = 10,
        days_back: int = 7,
        verbose: bool = False
    ) -> Dict[str, Any]:
        """
        Ingest data from all or specific connectors configured for a workspace

        Args:
            workspace_id: Workspace UUID to ingest for
            connector_type: Specific connector type to ingest from (optional, all if None)
            limit: Maximum number of records per connector
            days_back: How many days back to fetch data
            verbose: Enable verbose logging

        Returns:
            Dict with ingestion results per connector
        """
        if verbose:
            logging.getLogger().setLevel(logging.DEBUG)

        results = {
            'workspace_id': workspace_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'connectors_processed': 0,
            'total_records_ingested': 0,
            'connector_results': {},
            'errors': []
        }

        try:
            # Get database session
            db: Session = next(get_db())

            # Verify workspace exists
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if not workspace:
                error_msg = f"Workspace {workspace_id} not found"
                logger.error(error_msg)
                results['errors'].append(error_msg)
                return results

            logger.info(f"🔄 Starting ingestion for workspace: {workspace.name} ({workspace_id})")

            # Get configured connectors
            query = db.query(WorkspaceConnector).filter(
                WorkspaceConnector.workspace_id == workspace_id,
                WorkspaceConnector.is_active == True
            )

            if connector_type:
                query = query.filter(WorkspaceConnector.connector_type == connector_type)

            connectors = query.all()

            if not connectors:
                warning_msg = f"No active {connector_type or ''} connector(s) configured for workspace"
                logger.warning(warning_msg)
                results['warnings'] = [warning_msg]
                return results

            logger.info(f"Found {len(connectors)} active connector(s) for workspace")

            # Process each connector
            for connector in connectors:
                try:
                    logger.info(f"\n📊 Processing {connector.connector_type} connector")
                    result = await self._ingest_from_connector(
                        workspace_id=workspace_id,
                        connector=connector,
                        limit=limit,
                        days_back=days_back,
                        db=db
                    )

                    results['connector_results'][f"{connector.connector_type}_{connector.id}"] = result
                    results['connectors_processed'] += 1
                    results['total_records_ingested'] += result.get('records_ingested', 0)

                    logger.info(
                        f"✅ {connector.connector_type} ingestion completed: "
                        f"{result.get('records_ingested', 0)} records"
                    )

                except Exception as e:
                    error_msg = f"Error ingesting from {connector.connector_type}: {str(e)}"
                    logger.error(error_msg, exc_info=True)
                    results['errors'].append(error_msg)

            logger.info(f"\n🎉 Ingestion complete for workspace {workspace_id}")
            logger.info(
                f"Summary: {results['connectors_processed']} connector(s), "
                f"{results['total_records_ingested']} total records ingested"
            )

        except Exception as e:
            error_msg = f"Fatal error during ingestion: {str(e)}"
            logger.error(error_msg, exc_info=True)
            results['errors'].append(error_msg)

        return results

    async def _ingest_from_connector(
        self,
        workspace_id: str,
        connector: WorkspaceConnector,
        limit: int,
        days_back: int,
        db: Session
    ) -> Dict[str, Any]:
        """
        Ingest data from a specific connector

        Args:
            workspace_id: Workspace UUID
            connector: WorkspaceConnector instance with credentials
            limit: Maximum records to fetch
            days_back: How many days back to fetch
            db: Database session

        Returns:
            Dict with connector-specific ingestion results
        """
        connector_type = connector.connector_type.lower()

        if connector_type not in self.connector_handlers:
            raise ValueError(f"Unknown connector type: {connector_type}")

        # Extract credentials from JSONB
        credentials = connector.credentials or {}
        logger.debug(f"Using credentials for {connector_type}: {list(credentials.keys())}")

        # Call appropriate handler based on connector type
        if connector_type == 'gong':
            return await self._ingest_gong(workspace_id, credentials, limit, days_back)
        elif connector_type == 'fathom':
            return await self._ingest_fathom(workspace_id, credentials, limit, days_back)
        else:
            raise ValueError(f"No handler implemented for connector type: {connector_type}")

    async def _ingest_gong(
        self,
        workspace_id: str,
        credentials: Dict[str, Any],
        limit: int,
        days_back: int
    ) -> Dict[str, Any]:
        """Ingest Gong call data using workspace credentials"""
        try:
            if 'access_key' not in credentials or 'secret_key' not in credentials:
                raise ValueError("Gong credentials missing required keys: access_key, secret_key")

            handler = self.connector_handlers['gong']
            records_ingested = await handler(
                workspace_id=workspace_id,
                access_key=credentials['access_key'],
                secret_key=credentials['secret_key'],
                limit=limit,
                days_back=days_back
            )

            return {
                'connector_type': 'gong',
                'records_ingested': records_ingested,
                'status': 'success'
            }

        except Exception as e:
            logger.error(f"Gong ingestion failed: {str(e)}", exc_info=True)
            return {
                'connector_type': 'gong',
                'records_ingested': 0,
                'status': 'failed',
                'error': str(e)
            }

    async def _ingest_fathom(
        self,
        workspace_id: str,
        credentials: Dict[str, Any],
        limit: int,
        days_back: int
    ) -> Dict[str, Any]:
        """Ingest Fathom session data using workspace credentials"""
        try:
            if 'api_token' not in credentials:
                raise ValueError("Fathom credentials missing required key: api_token")

            handler = self.connector_handlers['fathom']
            records_ingested = await handler(
                workspace_id=workspace_id,
                api_token=credentials['api_token'],
                limit=limit,
                days_back=days_back
            )

            return {
                'connector_type': 'fathom',
                'records_ingested': records_ingested,
                'status': 'success'
            }

        except Exception as e:
            logger.error(f"Fathom ingestion failed: {str(e)}", exc_info=True)
            return {
                'connector_type': 'fathom',
                'records_ingested': 0,
                'status': 'failed',
                'error': str(e)
            }


async def main():
    """CLI entry point for the ingestion script"""
    parser = argparse.ArgumentParser(
        description='Ingest data from workspace connectors',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--workspace-id',
        type=str,
        required=True,
        help='UUID of the workspace to ingest data for'
    )

    parser.add_argument(
        '--connector-type',
        type=str,
        default=None,
        choices=['gong', 'fathom'],
        help='Specific connector type to ingest from (all if not specified)'
    )

    parser.add_argument(
        '--limit',
        type=int,
        default=10,
        help='Maximum number of records to ingest per connector (default: 10)'
    )

    parser.add_argument(
        '--days-back',
        type=int,
        default=7,
        help='How many days back to fetch data (default: 7)'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Create orchestrator and run ingestion
    orchestrator = ConnectorIngestionOrchestrator()
    results = await orchestrator.ingest_from_workspace_connectors(
        workspace_id=args.workspace_id,
        connector_type=args.connector_type,
        limit=args.limit,
        days_back=args.days_back,
        verbose=args.verbose
    )

    # Print results summary
    logger.info("\n" + "=" * 80)
    logger.info("INGESTION RESULTS SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Workspace ID: {results['workspace_id']}")
    logger.info(f"Connectors Processed: {results['connectors_processed']}")
    logger.info(f"Total Records Ingested: {results['total_records_ingested']}")

    if results['errors']:
        logger.error(f"Errors Encountered ({len(results['errors'])})")
        for error in results['errors']:
            logger.error(f"  - {error}")

    logger.info("=" * 80)

    # Exit with appropriate code
    sys.exit(0 if not results['errors'] else 1)


if __name__ == '__main__':
    asyncio.run(main())

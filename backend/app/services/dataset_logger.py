# backend/app/services/dataset_logger.py
"""
JSONL loggers for AI pipeline input data.
Used for Langfuse dataset generation and prompt optimization.

Tier 1: Classification inputs (text, source_type, actor_role)
Tier 2: Extraction inputs (text, source_type, actor info, themes, existing features)
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any
import threading


class Tier1InputLogger:
    """Thread-safe JSONL logger for Tier 1 classification inputs."""

    _instance: Optional["Tier1InputLogger"] = None
    _lock = threading.Lock()

    def __init__(self, file_path: str = "data/tier1_inputs.jsonl"):
        self.file_path = Path(file_path)
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self._file_lock = threading.Lock()

    @classmethod
    def get_instance(cls, file_path: str = "data/tier1_inputs.jsonl") -> "Tier1InputLogger":
        """Get singleton instance of the logger."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(file_path)
        return cls._instance

    def log(
        self,
        text: str,
        source_type: str,
        actor_role: str,
        workspace_id: Optional[str] = None,
        event_id: Optional[str] = None,
    ) -> str:
        """
        Log tier 1 input to JSONL file.

        Args:
            text: The message text being classified
            source_type: Source connector (slack, gmail, gong, fathom)
            actor_role: Role of the message sender
            workspace_id: Optional workspace UUID
            event_id: Optional event UUID

        Returns:
            The generated item ID (UUID string)
        """
        item_id = str(uuid.uuid4())

        item = {
            "id": item_id,
            "text": text,
            "source_type": source_type,
            "actor_role": actor_role,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if workspace_id:
            item["workspace_id"] = workspace_id
        if event_id:
            item["event_id"] = event_id

        with self._file_lock:
            with open(self.file_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

        return item_id


class Tier2InputLogger:
    """Thread-safe JSONL logger for Tier 2 extraction inputs."""

    _instance: Optional["Tier2InputLogger"] = None
    _lock = threading.Lock()

    def __init__(self, file_path: str = "data/tier2_inputs.jsonl"):
        self.file_path = Path(file_path)
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self._file_lock = threading.Lock()

    @classmethod
    def get_instance(cls, file_path: str = "data/tier2_inputs.jsonl") -> "Tier2InputLogger":
        """Get singleton instance of the logger."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(file_path)
        return cls._instance

    def log(
        self,
        text: str,
        source_type: str,
        actor_name: Optional[str] = None,
        actor_role: Optional[str] = None,
        title: Optional[str] = None,
        themes: Optional[List[Dict[str, Any]]] = None,
        existing_features: Optional[List[Dict[str, Any]]] = None,
        workspace_id: Optional[str] = None,
        event_id: Optional[str] = None,
    ) -> str:
        """
        Log tier 2 input to JSONL file.

        Args:
            text: The message text for feature extraction
            source_type: Source connector (slack, gmail, gong, fathom)
            actor_name: Name of the person making the request
            actor_role: Role of the message sender
            title: Email subject or source title
            themes: Available themes [{name, description}]
            existing_features: Existing features [{id, name, theme_name}]
            workspace_id: Optional workspace UUID
            event_id: Optional event UUID

        Returns:
            The generated item ID (UUID string)
        """
        item_id = str(uuid.uuid4())

        item = {
            "id": item_id,
            "text": text,
            "source_type": source_type,
            "actor_name": actor_name or "Unknown",
            "actor_role": actor_role or "unknown",
            "title": title,
            "themes": themes,
            "existing_features": existing_features,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if workspace_id:
            item["workspace_id"] = workspace_id
        if event_id:
            item["event_id"] = event_id

        with self._file_lock:
            with open(self.file_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

        return item_id

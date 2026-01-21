"""
Taxonomy Generation Service

Generates a 6x6 product taxonomy from a website URL.
Uses Firecrawl for crawling and OpenAI for taxonomy inference.
"""

import json
import logging
import hashlib
from typing import List
from dataclasses import dataclass

import openai
from firecrawl import Firecrawl
from firecrawl.types import ScrapeOptions

from app.core.config import settings

logger = logging.getLogger(__name__)


# -------------------------------------------------------------------
# Models
# -------------------------------------------------------------------

@dataclass
class SubTheme:
    name: str
    description: str
    confidence: float  # 60–95


@dataclass
class Theme:
    name: str
    description: str
    confidence: float  # 60–95
    sub_themes: List[SubTheme]


@dataclass
class CrawledPage:
    url: str
    title: str
    content: str
    meta_description: str


# -------------------------------------------------------------------
# Prompt
# -------------------------------------------------------------------

TAXONOMY_PROMPT = """You are a product taxonomy expert.

Analyze the following website content and generate a product taxonomy.

CRAWLED WEBSITE CONTENT:
{content}

REQUIREMENTS:
- Generate EXACTLY 6 themes
- Each theme MUST have EXACTLY 6 sub-themes
- Confidence scores must be between 60 and 95

THEME RULES:
- Customer-facing language
- 2–4 words
- Represents core product value

SUB-THEME RULES:
- Concrete product capabilities
- 2–4 words
- Specific to the parent theme

AVOID:
- Generic buckets (Settings, Admin, Help)
- Technical jargon
- Overlapping concepts

Return JSON ONLY in this exact structure:
{{
  "themes": [
    {{
      "name": "Theme Name",
      "description": "What this product area covers",
      "confidence": 85,
      "sub_themes": [
        {{ "name": "Feature", "description": "What it does", "confidence": 80 }}
      ]
    }}
  ]
}}
"""


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def _clamp_confidence(value: float) -> float:
    return max(60.0, min(95.0, value))


def _clean_page_content(content: str) -> str:
    """Remove navigation, boilerplate, and low-signal text."""
    if not content:
        return ""

    lines = content.splitlines()
    useful = []

    for line in lines:
        line = line.strip()
        if len(line) < 40:
            continue
        if any(x in line.lower() for x in [
            "cookie", "privacy", "terms", "copyright",
            "all rights reserved"
        ]):
            continue
        useful.append(line)

    return "\n".join(useful[:200])


def _is_relevant_url(url: str) -> bool:
    blacklist = ["/blog", "/careers", "/pricing", "/legal", "/terms", "/privacy"]
    return not any(b in url.lower() for b in blacklist)


# -------------------------------------------------------------------
# Crawling
# -------------------------------------------------------------------

def crawl_website(url: str, max_pages: int = 10) -> List[CrawledPage]:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    pages: List[CrawledPage] = []
    seen_hashes = set()

    try:
        firecrawl = Firecrawl(api_key=settings.FIRECRAWL_API_KEY)
        logger.info(f"Crawling website with Firecrawl: {url}")

        # Use crawl with scrape_options
        result = firecrawl.crawl(
            url=url,
            limit=max_pages,
            scrape_options=ScrapeOptions(formats=["markdown"]),
            poll_interval=2,
            timeout=120
        )

        logger.info(f"Firecrawl response type: {type(result)}")
        logger.info(f"Firecrawl response keys: {result.keys() if isinstance(result, dict) else 'not a dict'}")

        # Handle response - data might be in different formats
        data_items = []
        if isinstance(result, dict):
            data_items = result.get("data", [])
            if not data_items:
                # Try other possible keys
                data_items = result.get("results", [])
                if not data_items and "markdown" in result:
                    # Single page result
                    data_items = [result]
        elif isinstance(result, list):
            data_items = result

        logger.info(f"Found {len(data_items)} items in crawl result")

        for item in data_items:
            if not isinstance(item, dict):
                continue

            metadata = item.get("metadata", {})
            page_url = metadata.get("sourceURL") or metadata.get("url") or url

            if not _is_relevant_url(page_url):
                continue

            raw_content = item.get("markdown") or item.get("content") or item.get("html") or ""
            cleaned = _clean_page_content(raw_content)

            if not cleaned:
                logger.debug(f"No usable content from {page_url}")
                continue

            content_hash = hashlib.sha256(cleaned[:1000].encode()).hexdigest()
            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)

            pages.append(CrawledPage(
                url=page_url,
                title=metadata.get("title", page_url),
                meta_description=metadata.get("description", ""),
                content=cleaned[:3000]
            ))
            logger.info(f"Added page: {page_url} ({len(cleaned)} chars)")

        logger.info(f"Crawled {len(pages)} usable pages")

    except Exception as e:
        logger.error(f"Firecrawl crawl failed: {e}", exc_info=True)
        # Try single page scrape as fallback
        try:
            logger.info(f"Trying single page scrape for: {url}")
            firecrawl = Firecrawl(api_key=settings.FIRECRAWL_API_KEY)
            scrape_result = firecrawl.scrape(url, formats=["markdown"])

            logger.info(f"Scrape result type: {type(scrape_result)}")

            if scrape_result:
                content = scrape_result.get("markdown") or scrape_result.get("content") or ""
                metadata = scrape_result.get("metadata", {})
                cleaned = _clean_page_content(content)

                if cleaned:
                    pages.append(CrawledPage(
                        url=url,
                        title=metadata.get("title", url),
                        meta_description=metadata.get("description", ""),
                        content=cleaned[:3000]
                    ))
                    logger.info(f"Single page scrape successful: {len(cleaned)} chars")
        except Exception as scrape_error:
            logger.error(f"Single page scrape also failed: {scrape_error}", exc_info=True)

    return pages


# -------------------------------------------------------------------
# AI Generation
# -------------------------------------------------------------------

def generate_taxonomy_from_url(url: str) -> List[Theme]:
    pages = crawl_website(url)

    if not pages:
        logger.warning("No crawl data available, using fallback taxonomy")
        return _fallback_taxonomy()

    combined = f"Website: {url}\n"
    for p in pages:
        combined += f"\n\n### {p.title}\n{p.content}"

    combined = combined[:15000]
    logger.info(f"Sending {len(combined)} chars to OpenAI")

    try:
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": TAXONOMY_PROMPT.format(content=combined)}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        raw = json.loads(response.choices[0].message.content)
        themes = _parse_themes(raw.get("themes", []))

        return _ensure_exact_structure(themes)

    except Exception as e:
        logger.error(f"OpenAI taxonomy generation failed: {e}", exc_info=True)
        return _fallback_taxonomy()


# -------------------------------------------------------------------
# Parsing & Validation
# -------------------------------------------------------------------

def _parse_themes(data: List[dict]) -> List[Theme]:
    themes: List[Theme] = []

    for t in data:
        subs = [
            SubTheme(
                name=s.get("name", "Feature"),
                description=s.get("description", ""),
                confidence=_clamp_confidence(float(s.get("confidence", 70))),
            )
            for s in t.get("sub_themes", [])
        ]

        themes.append(Theme(
            name=t.get("name", "Theme"),
            description=t.get("description", ""),
            confidence=_clamp_confidence(float(t.get("confidence", 70))),
            sub_themes=subs,
        ))

    return themes


def _ensure_exact_structure(themes: List[Theme]) -> List[Theme]:
    themes = themes[:6]

    while len(themes) < 6:
        themes.append(_fallback_theme(len(themes)))

    for theme in themes:
        theme.sub_themes = theme.sub_themes[:6]
        while len(theme.sub_themes) < 6:
            theme.sub_themes.append(
                SubTheme(
                    name=f"Capability {len(theme.sub_themes)+1}",
                    description=f"Key capability in {theme.name}",
                    confidence=65,
                )
            )

    return themes


# -------------------------------------------------------------------
# Fallbacks (Prompt-compliant)
# -------------------------------------------------------------------

def _fallback_theme(idx: int) -> Theme:
    names = [
        "Product Insights",
        "Customer Feedback",
        "Workflow Control",
        "Team Collaboration",
        "Data Visibility",
        "Platform Reliability",
    ]

    return Theme(
        name=names[idx],
        description=f"Core area of {names[idx].lower()}",
        confidence=65,
        sub_themes=[
            SubTheme(
                name=f"Capability {i+1}",
                description=f"Key capability for {names[idx]}",
                confidence=65,
            )
            for i in range(6)
        ],
    )


def _fallback_taxonomy() -> List[Theme]:
    return [_fallback_theme(i) for i in range(6)]


# -------------------------------------------------------------------
# Serialization
# -------------------------------------------------------------------

def themes_to_dict(themes: List[Theme]) -> List[dict]:
    return [
        {
            "name": t.name,
            "description": t.description,
            "confidence": t.confidence,
            "sub_themes": [
                {
                    "name": s.name,
                    "description": s.description,
                    "confidence": s.confidence,
                }
                for s in t.sub_themes
            ],
        }
        for t in themes
    ]

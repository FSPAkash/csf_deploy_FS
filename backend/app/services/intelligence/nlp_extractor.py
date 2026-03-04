"""
NLP Extractor Service
Uses OpenAI GPT-4 to extract structured competitive intelligence from unstructured text.
CRITICAL: Only extracts information explicitly stated - no hallucinations or inferences.
"""

import os
import json
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict, field
import re

# Try to import OpenAI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


# Event types that can be extracted
EVENT_TYPES = {
    'product_launch': {
        'description': 'Competitor launches new product line',
        'typical_impact_range': (-8, -1),  # Brand-level: major launch captures 2-5% share (LBNL brand elasticity ~2.0)
        'impact_duration_months': (3, 12),
        'keywords': ['launch', 'introduce', 'unveil', 'announce', 'new product', 'release']
    },
    'pricing_change': {
        'description': 'Competitor price increase or decrease',
        'typical_impact_range': (-12, 12),  # Brand cross-price elasticity ~2.0 (LBNL-326E); 5-10% price move shifts 10-25% brand demand
        'impact_duration_months': (1, 6),
        'keywords': ['price', 'pricing', 'cost', 'rebate', 'discount', 'increase', 'decrease']
    },
    'supply_disruption': {
        'description': 'Supply chain issue affecting competitor',
        'typical_impact_range': (3, 15),  # COVID HARDI data: -12 to -19% industry; competitor-specific disruptions yield +5-15% for us
        'impact_duration_months': (2, 9),
        'keywords': ['shortage', 'delay', 'backorder', 'supply chain', 'disruption', 'constraint']
    },
    'regulatory_change': {
        'description': 'New efficiency standards or refrigerant rules',
        'typical_impact_range': (-20, 25),  # IRA drove +15-30% HP demand (IEA); SEER2 +5-15% pull-forward; refrigerant phase-outs +10-20%
        'impact_duration_months': (6, 24),
        'keywords': ['EPA', 'DOE', 'regulation', 'standard', 'requirement', 'compliance', 'mandate']
    },
    'capacity_expansion': {
        'description': 'Competitor factory expansion or new facility',
        'typical_impact_range': (-5, -1),  # Long-term competitive pressure from increased competitor capacity
        'impact_duration_months': (6, 18),
        'keywords': ['factory', 'facility', 'expansion', 'plant', 'manufacturing', 'investment']
    },
    'market_entry': {
        'description': 'New competitor enters market',
        'typical_impact_range': (-8, -2),  # Well-funded entrants capture 2-5% year one; HP 33->47% cooling share over 10yr (RMI)
        'impact_duration_months': (12, 36),
        'keywords': ['enter', 'entry', 'acquisition', 'joint venture', 'expand into']
    },
    'market_exit': {
        'description': 'Competitor exits market or product line',
        'typical_impact_range': (3, 12),  # Exiting competitor share redistributes proportionally among remaining players
        'impact_duration_months': (3, 12),
        'keywords': ['exit', 'discontinue', 'divest', 'withdraw', 'shut down', 'close']
    }
}

# HVAC competitors to track
HVAC_COMPETITORS = [
    'Carrier', 'Trane', 'Lennox', 'Johnson Controls', 'York',
    'Rheem', 'Goodman', 'Mitsubishi Electric', 'Fujitsu', 'LG',
    'Samsung', 'Bosch', 'Bryant', 'American Standard', 'Ruud', 'Amana'
]

# Product categories
PRODUCT_CATEGORIES = ['HP', 'AH', 'CN', 'FN', 'CL']


@dataclass
class ExtractedEvent:
    """Structured event extracted from text."""
    event_id: str
    event_type: str
    company: Optional[str]
    headline: str
    description: str
    date_mentioned: Optional[str]  # Date mentioned in text
    expected_date: Optional[str]  # YYYY-MM format
    products_affected: List[str]
    geographic_scope: str
    impact_stated: Optional[str]  # Exact quote if impact mentioned
    confidence: str  # 'high', 'medium', 'low'
    confidence_reason: str
    supporting_quote: str
    source_url: str
    source_name: str
    extracted_at: str

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ExtractionResult:
    """Result of NLP extraction from a document."""
    success: bool
    events: List[ExtractedEvent]
    no_relevant_events: bool
    extraction_notes: str
    processing_time_ms: int
    model_used: str
    token_count: Optional[int]

    def to_dict(self) -> Dict:
        return {
            'success': self.success,
            'events': [e.to_dict() for e in self.events],
            'no_relevant_events': self.no_relevant_events,
            'extraction_notes': self.extraction_notes,
            'processing_time_ms': self.processing_time_ms,
            'model_used': self.model_used,
            'token_count': self.token_count
        }


class NLPExtractor:
    """
    NLP-based extraction of competitive intelligence.
    Uses OpenAI GPT-4 with strict prompts to prevent hallucination.
    """

    EXTRACTION_SYSTEM_PROMPT = """You are an HVAC market intelligence analyst. Your job is to extract structured competitive intelligence from news articles and press releases.

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
1. ONLY extract information that is EXPLICITLY stated in the text
2. NEVER infer, assume, or make up impact percentages - if not stated, use null
3. NEVER invent dates that aren't mentioned - if unclear, use "unspecified"
4. Always include the EXACT quote that supports your extraction
5. If uncertain about anything, set confidence to "low" and explain why
6. If no relevant events are found, return an empty events array

COMPETITORS TO TRACK:
- Carrier (United Technologies)
- Trane (Trane Technologies)
- Lennox International
- Johnson Controls / York
- Rheem
- Goodman (Note: owned by Manufacturer - flag if mentioned)
- Mitsubishi Electric
- Fujitsu
- LG
- Samsung
- Bosch
- Bryant
- American Standard
- Ruud
- Amana

PRODUCT CATEGORIES (map to these if mentioned):
- HP: Heat pumps, heat pump systems
- AH: Air handlers
- CN: Condensers, condenser units
- FN: Furnaces
- CL: Chillers

EVENT TYPES TO EXTRACT:
- product_launch: New product announcements, releases, unveilings
- pricing_change: Price increases, decreases, rebate programs
- supply_disruption: Shortages, delays, backorders affecting competitors
- regulatory_change: EPA, DOE, efficiency standards, refrigerant rules
- capacity_expansion: Factory expansions, new facilities
- market_entry: New competitor entering HVAC market
- market_exit: Competitor leaving market or discontinuing products

OUTPUT FORMAT (JSON):
{
  "events": [
    {
      "event_type": "one of the types above",
      "company": "company name or null if regulatory",
      "headline": "brief 1-line summary",
      "description": "2-3 sentence description",
      "date_mentioned": "exact date/timeframe from text or 'unspecified'",
      "expected_date": "YYYY-MM format if determinable, else null",
      "products_affected": ["HP", "AH", etc. or empty array if unclear],
      "geographic_scope": "US|regional|global",
      "impact_stated": "exact quote if impact/numbers mentioned, else null",
      "confidence": "high|medium|low",
      "confidence_reason": "why this confidence level",
      "supporting_quote": "exact text from article supporting this extraction"
    }
  ],
  "no_relevant_events": true/false,
  "extraction_notes": "any caveats, uncertainties, or things you couldn't extract"
}

CONFIDENCE GUIDELINES:
- high: Clear announcement with specific details, from official source
- medium: Information present but some details unclear or from secondary source
- low: Mentioned tangentially, rumors, or speculation

Remember: It's better to extract nothing than to make something up. If the text doesn't contain HVAC competitive intelligence, return an empty events array."""

    def __init__(self):
        self.client = None
        self.model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        self._extraction_cache: Dict[str, 'ExtractionResult'] = {}

        if OPENAI_AVAILABLE:
            api_key = os.environ.get('OPENAI_API_KEY')
            if api_key:
                self.client = OpenAI(api_key=api_key)

    def has_cached(self, source_url: str) -> bool:
        """Check if extraction results exist in cache for this URL."""
        cache_key = hashlib.md5(source_url.encode()).hexdigest()
        return cache_key in self._extraction_cache

    def _generate_event_id(self, event_data: Dict, source_url: str) -> str:
        """Generate unique ID for an event based on content."""
        content = f"{event_data.get('event_type', '')}:{event_data.get('company', '')}:{event_data.get('headline', '')}:{source_url}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

    def extract_from_text(
        self,
        text: str,
        source_url: str,
        source_name: str
    ) -> ExtractionResult:
        """
        Extract competitive intelligence events from text.

        Args:
            text: The article/document text to analyze
            source_url: URL of the source
            source_name: Name of the source (e.g., "Reuters")

        Returns:
            ExtractionResult with extracted events
        """
        start_time = datetime.now()

        # Check extraction cache first
        cache_key = hashlib.md5(source_url.encode()).hexdigest()
        if cache_key in self._extraction_cache:
            return self._extraction_cache[cache_key]

        if not self.client:
            return ExtractionResult(
                success=False,
                events=[],
                no_relevant_events=True,
                extraction_notes="OpenAI client not available. Please set OPENAI_API_KEY.",
                processing_time_ms=0,
                model_used="none",
                token_count=None
            )

        # Truncate very long texts
        max_chars = 12000
        if len(text) > max_chars:
            text = text[:max_chars] + "\n[Text truncated for processing]"

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Extract competitive intelligence from this article:\n\n{text}"}
                ],
                response_format={"type": "json_object"},
                max_tokens=2000,
                temperature=0.1  # Low temperature for consistent extraction
            )

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            # Parse response
            response_text = response.choices[0].message.content
            try:
                extracted_data = json.loads(response_text)
            except json.JSONDecodeError:
                return ExtractionResult(
                    success=False,
                    events=[],
                    no_relevant_events=True,
                    extraction_notes=f"Failed to parse JSON response: {response_text[:200]}",
                    processing_time_ms=processing_time,
                    model_used=self.model,
                    token_count=response.usage.total_tokens if response.usage else None
                )

            # Convert to ExtractedEvent objects
            events = []
            for event_data in extracted_data.get('events', []):
                event_id = self._generate_event_id(event_data, source_url)

                event = ExtractedEvent(
                    event_id=event_id,
                    event_type=event_data.get('event_type', 'unknown'),
                    company=event_data.get('company'),
                    headline=event_data.get('headline', ''),
                    description=event_data.get('description', ''),
                    date_mentioned=event_data.get('date_mentioned'),
                    expected_date=event_data.get('expected_date'),
                    products_affected=event_data.get('products_affected', []),
                    geographic_scope=event_data.get('geographic_scope', 'US'),
                    impact_stated=event_data.get('impact_stated'),
                    confidence=event_data.get('confidence', 'low'),
                    confidence_reason=event_data.get('confidence_reason', ''),
                    supporting_quote=event_data.get('supporting_quote', ''),
                    source_url=source_url,
                    source_name=source_name,
                    extracted_at=datetime.now().isoformat()
                )
                events.append(event)

            result = ExtractionResult(
                success=True,
                events=events,
                no_relevant_events=extracted_data.get('no_relevant_events', len(events) == 0),
                extraction_notes=extracted_data.get('extraction_notes', ''),
                processing_time_ms=processing_time,
                model_used=self.model,
                token_count=response.usage.total_tokens if response.usage else None
            )
            self._extraction_cache[cache_key] = result
            return result

        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            return ExtractionResult(
                success=False,
                events=[],
                no_relevant_events=True,
                extraction_notes=f"Extraction error: {str(e)}",
                processing_time_ms=processing_time,
                model_used=self.model,
                token_count=None
            )

    def extract_from_search_results(
        self,
        search_results: List[Dict]
    ) -> List[ExtractionResult]:
        """
        Extract events from multiple search results.

        Args:
            search_results: List of SearchResult dicts with 'title', 'snippet', 'url', 'source_name'

        Returns:
            List of ExtractionResult for each search result
        """
        results = []

        for result in search_results:
            # Combine title and snippet for extraction
            text = f"Title: {result.get('title', '')}\n\n{result.get('snippet', '')}"

            extraction = self.extract_from_text(
                text=text,
                source_url=result.get('url', ''),
                source_name=result.get('source_name', 'Unknown')
            )
            results.append(extraction)

        return results

    def get_event_type_info(self, event_type: str) -> Dict:
        """Get information about an event type including typical impact ranges."""
        return EVENT_TYPES.get(event_type, {
            'description': 'Unknown event type',
            'typical_impact_range': (-5, 5),
            'impact_duration_months': (1, 12),
            'keywords': []
        })

    def validate_extraction(self, event: ExtractedEvent) -> Dict[str, Any]:
        """
        Validate an extracted event for quality and completeness.

        Returns:
            Dictionary with validation results and warnings
        """
        warnings = []
        quality_score = 1.0

        # Check for required fields
        if not event.headline:
            warnings.append("Missing headline")
            quality_score -= 0.2

        if not event.supporting_quote:
            warnings.append("No supporting quote provided")
            quality_score -= 0.3

        if event.event_type not in EVENT_TYPES:
            warnings.append(f"Unknown event type: {event.event_type}")
            quality_score -= 0.2

        # Check confidence
        if event.confidence == 'low':
            warnings.append("Low confidence extraction")
            quality_score -= 0.2

        # Check if Goodman is mentioned (owned by Manufacturer)
        if event.company and 'goodman' in event.company.lower():
            warnings.append("Goodman is owned by Manufacturer - this may be internal news")

        return {
            'is_valid': quality_score >= 0.5,
            'quality_score': max(0, quality_score),
            'warnings': warnings
        }


# Singleton instance
_nlp_extractor = None

def get_nlp_extractor() -> NLPExtractor:
    """Get or create the NLP extractor singleton."""
    global _nlp_extractor
    if _nlp_extractor is None:
        _nlp_extractor = NLPExtractor()
    return _nlp_extractor

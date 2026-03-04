"""
Trust Scorer Service
Calculates and validates trust scores for intelligence sources.
All scores are transparently derived from documented criteria.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass


@dataclass
class TrustAssessment:
    """Result of trust assessment for an event."""
    final_score: float
    source_score: float
    recency_score: float
    confidence_score: float
    corroboration_score: float
    breakdown: Dict[str, float]
    warnings: List[str]
    explanation: str


class TrustScorer:
    """
    Calculates trust scores for intelligence events based on multiple factors.
    All scoring is transparent and documented.
    """

    # Source reputation scores (0-1)
    SOURCE_SCORES = {
        # Official Government Sources (100%)
        'sec.gov': 1.0,
        'epa.gov': 1.0,
        'energy.gov': 1.0,
        'federalregister.gov': 1.0,
        'fred.stlouisfed.org': 1.0,

        # Industry Authorities (88-90%)
        'ahrinet.org': 0.90,
        'energystar.gov': 0.90,
        'ashrae.org': 0.88,

        # Company Official Sources (85%)
        'carrier.com': 0.85,
        'trane.com': 0.85,
        'lennox.com': 0.85,
        'johnsoncontrols.com': 0.85,
        'rheem.com': 0.85,
        'daikin.com': 0.85,
        'mitsubishielectric.com': 0.85,
        'lg.com': 0.85,
        'samsung.com': 0.85,
        'bosch.com': 0.85,

        # Press Release Services (72%)
        'prnewswire.com': 0.72,
        'businesswire.com': 0.72,
        'globenewswire.com': 0.72,

        # Major Business News (75-80%)
        'reuters.com': 0.80,
        'bloomberg.com': 0.80,
        'wsj.com': 0.78,
        'ft.com': 0.78,
        'nytimes.com': 0.76,

        # Trade Publications (73-75%)
        'achrnews.com': 0.75,
        'contractingbusiness.com': 0.75,
        'hvacindustry.com': 0.73,
        'coolingpost.com': 0.73,
        'hpacmag.com': 0.73,

        # General Business News (60-68%)
        'cnbc.com': 0.68,
        'marketwatch.com': 0.65,
        'seekingalpha.com': 0.62,

        # General News (50-60%)
        'cnn.com': 0.58,
        'foxbusiness.com': 0.55,
        'yahoo.com': 0.55,

        # Social/Aggregators (40-45%)
        'reddit.com': 0.40,
        'twitter.com': 0.40,

        # Default
        'default': 0.50
    }

    # Confidence level scores
    CONFIDENCE_SCORES = {
        'high': 1.0,
        'medium': 0.7,
        'low': 0.4
    }

    # Weight factors for final score
    WEIGHTS = {
        'source': 0.40,      # 40% from source reputation
        'recency': 0.15,     # 15% from how recent
        'confidence': 0.25,  # 25% from extraction confidence
        'corroboration': 0.20  # 20% from multiple source corroboration
    }

    def __init__(self):
        pass

    def get_source_score(self, url: str) -> Tuple[float, str]:
        """
        Get trust score for a URL based on domain.

        Returns:
            Tuple of (score, domain_matched)
        """
        if not url:
            return 0.3, 'unknown'

        url_lower = url.lower()
        for domain, score in self.SOURCE_SCORES.items():
            if domain in url_lower:
                return score, domain

        return self.SOURCE_SCORES['default'], 'default'

    def calculate_recency_score(self, date_str: Optional[str]) -> float:
        """
        Calculate recency score based on extraction/event date.
        More recent = higher score.

        Args:
            date_str: ISO format datetime string

        Returns:
            Score from 0 to 1
        """
        if not date_str:
            return 0.5  # Unknown date gets neutral score

        try:
            event_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            days_old = (datetime.now(event_date.tzinfo if event_date.tzinfo else None) - event_date).days

            if days_old < 0:
                days_old = 0  # Future date

            # Scoring: <7 days = 1.0, <30 days = 0.8, <90 days = 0.6, <180 days = 0.4, older = 0.3
            if days_old <= 7:
                return 1.0
            elif days_old <= 30:
                return 0.8
            elif days_old <= 90:
                return 0.6
            elif days_old <= 180:
                return 0.4
            else:
                return 0.3

        except (ValueError, TypeError):
            return 0.5

    def calculate_confidence_score(self, confidence: str) -> float:
        """Get score based on extraction confidence level."""
        return self.CONFIDENCE_SCORES.get(confidence.lower(), 0.5)

    def calculate_corroboration_score(
        self,
        event: Dict,
        other_events: List[Dict]
    ) -> Tuple[float, int]:
        """
        Calculate score based on corroboration from other sources.

        Args:
            event: The event being scored
            other_events: Other events to check for corroboration

        Returns:
            Tuple of (score, number_of_corroborating_sources)
        """
        if not other_events:
            return 0.5, 0  # No other events to corroborate

        corroborating_sources = 0
        event_company = (event.get('company') or '').lower()
        event_type = event.get('event_type', '').lower()
        event_headline = (event.get('headline') or '').lower()

        for other in other_events:
            # Skip if same source
            if other.get('source_url') == event.get('source_url'):
                continue

            other_company = (other.get('company') or '').lower()
            other_type = other.get('event_type', '').lower()
            other_headline = (other.get('headline') or '').lower()

            # Check for similar company + event type
            if event_company and event_company == other_company and event_type == other_type:
                corroborating_sources += 1
            # Check for similar headline keywords
            elif self._headlines_similar(event_headline, other_headline):
                corroborating_sources += 1

        # Scoring: 0 sources = 0.5, 1 source = 0.7, 2+ sources = 0.9, 3+ = 1.0
        if corroborating_sources >= 3:
            return 1.0, corroborating_sources
        elif corroborating_sources >= 2:
            return 0.9, corroborating_sources
        elif corroborating_sources >= 1:
            return 0.7, corroborating_sources
        else:
            return 0.5, 0

    def _headlines_similar(self, h1: str, h2: str) -> bool:
        """Check if two headlines are discussing the same topic."""
        if not h1 or not h2:
            return False

        # Simple keyword overlap check
        words1 = set(h1.split())
        words2 = set(h2.split())

        # Remove common words
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        words1 = words1 - common_words
        words2 = words2 - common_words

        if not words1 or not words2:
            return False

        overlap = len(words1.intersection(words2))
        min_words = min(len(words1), len(words2))

        return overlap / min_words >= 0.4 if min_words > 0 else False

    def assess_trust(
        self,
        event: Dict,
        other_events: Optional[List[Dict]] = None
    ) -> TrustAssessment:
        """
        Calculate comprehensive trust assessment for an event.

        Args:
            event: Event dictionary
            other_events: Other events for corroboration check

        Returns:
            TrustAssessment with detailed breakdown
        """
        warnings = []
        explanation_parts = []

        # Source score
        source_score, matched_domain = self.get_source_score(event.get('source_url', ''))
        explanation_parts.append(f"Source ({matched_domain}): {source_score:.0%}")

        if source_score < 0.6:
            warnings.append(f"Low-reputation source: {matched_domain}")

        # Recency score
        date_str = event.get('date_extracted') or event.get('extracted_at')
        recency_score = self.calculate_recency_score(date_str)
        explanation_parts.append(f"Recency: {recency_score:.0%}")

        if recency_score < 0.5:
            warnings.append("Information may be outdated")

        # Confidence score
        confidence = event.get('confidence', 'medium')
        confidence_score = self.calculate_confidence_score(confidence)
        explanation_parts.append(f"Extraction confidence ({confidence}): {confidence_score:.0%}")

        if confidence_score < 0.5:
            warnings.append("Low extraction confidence")

        # Corroboration score
        corroboration_score, num_sources = self.calculate_corroboration_score(
            event, other_events or []
        )
        explanation_parts.append(f"Corroboration ({num_sources} sources): {corroboration_score:.0%}")

        if num_sources == 0:
            warnings.append("Not corroborated by other sources")

        # Calculate weighted final score
        final_score = (
            source_score * self.WEIGHTS['source'] +
            recency_score * self.WEIGHTS['recency'] +
            confidence_score * self.WEIGHTS['confidence'] +
            corroboration_score * self.WEIGHTS['corroboration']
        )

        # Additional warnings based on event content
        if not event.get('supporting_quote'):
            warnings.append("No supporting quote provided")
            final_score *= 0.9  # 10% penalty

        if event.get('impact_stated') is None and event.get('impact_estimate_low') is not None:
            warnings.append("Impact estimate is inferred, not stated in source")

        return TrustAssessment(
            final_score=round(final_score, 3),
            source_score=source_score,
            recency_score=recency_score,
            confidence_score=confidence_score,
            corroboration_score=corroboration_score,
            breakdown={
                'source': source_score,
                'recency': recency_score,
                'confidence': confidence_score,
                'corroboration': corroboration_score
            },
            warnings=warnings,
            explanation=" | ".join(explanation_parts)
        )

    def get_trust_level(self, score: float) -> str:
        """
        Convert numeric score to human-readable trust level.

        Args:
            score: Trust score 0-1

        Returns:
            Trust level string
        """
        if score >= 0.85:
            return 'Official Source'
        elif score >= 0.70:
            return 'Verified Source'
        elif score >= 0.55:
            return 'News Source'
        elif score >= 0.40:
            return 'Unverified'
        else:
            return 'Low Confidence'

    def get_trust_color(self, score: float) -> str:
        """
        Get color class for trust score display.

        Args:
            score: Trust score 0-1

        Returns:
            Color identifier string
        """
        if score >= 0.85:
            return 'green'
        elif score >= 0.70:
            return 'blue'
        elif score >= 0.55:
            return 'yellow'
        elif score >= 0.40:
            return 'orange'
        else:
            return 'red'

    def explain_score(self, assessment: TrustAssessment) -> Dict[str, Any]:
        """
        Generate human-readable explanation of trust score.

        Args:
            assessment: TrustAssessment object

        Returns:
            Dictionary with explanation details
        """
        return {
            'final_score': assessment.final_score,
            'final_percentage': f"{assessment.final_score:.0%}",
            'trust_level': self.get_trust_level(assessment.final_score),
            'trust_color': self.get_trust_color(assessment.final_score),
            'breakdown': {
                'source_reputation': {
                    'score': assessment.source_score,
                    'weight': f"{self.WEIGHTS['source']:.0%}",
                    'contribution': f"{assessment.source_score * self.WEIGHTS['source']:.1%}"
                },
                'recency': {
                    'score': assessment.recency_score,
                    'weight': f"{self.WEIGHTS['recency']:.0%}",
                    'contribution': f"{assessment.recency_score * self.WEIGHTS['recency']:.1%}"
                },
                'extraction_confidence': {
                    'score': assessment.confidence_score,
                    'weight': f"{self.WEIGHTS['confidence']:.0%}",
                    'contribution': f"{assessment.confidence_score * self.WEIGHTS['confidence']:.1%}"
                },
                'corroboration': {
                    'score': assessment.corroboration_score,
                    'weight': f"{self.WEIGHTS['corroboration']:.0%}",
                    'contribution': f"{assessment.corroboration_score * self.WEIGHTS['corroboration']:.1%}"
                }
            },
            'warnings': assessment.warnings,
            'explanation': assessment.explanation
        }


# Singleton instance
_trust_scorer = None

def get_trust_scorer() -> TrustScorer:
    """Get or create the trust scorer singleton."""
    global _trust_scorer
    if _trust_scorer is None:
        _trust_scorer = TrustScorer()
    return _trust_scorer

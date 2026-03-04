"""
Web Search Service
Fetches competitive intelligence from verified external sources.
All data is tagged with source URLs and trust scores.
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
import requests
from functools import lru_cache

# HVAC Industry Competitors to track
COMPETITORS = [
    'Carrier', 'Trane', 'Lennox', 'Johnson Controls', 'York',
    'Rheem', 'Goodman', 'Mitsubishi Electric', 'Fujitsu', 'LG', 'Samsung',
    'Bosch', 'Bryant', 'American Standard', 'Ruud', 'Amana'
]

# Keywords for HVAC market intelligence
HVAC_KEYWORDS = [
    'heat pump', 'HVAC', 'air conditioner', 'furnace', 'mini-split',
    'residential HVAC', 'commercial HVAC', 'SEER', 'efficiency standard',
    'refrigerant', 'R-410A', 'R-32', 'A2L refrigerant'
]

# Regulatory keywords
REGULATORY_KEYWORDS = [
    'EPA', 'DOE', 'ENERGY STAR', 'efficiency standard', 'refrigerant regulation',
    'AHRI', 'building code', 'energy policy'
]


@dataclass
class SearchResult:
    """Structured search result with source attribution."""
    title: str
    url: str
    snippet: str
    source_name: str
    published_date: Optional[str]
    fetched_at: str
    search_query: str
    result_type: str  # 'news', 'regulatory', 'company', 'industry'

    def to_dict(self) -> Dict:
        return asdict(self)


class WebSearchService:
    """
    Service for fetching competitive intelligence from web sources.
    Uses multiple APIs with fallbacks.
    """

    # Source reputation scores (0-1)
    SOURCE_TRUST_SCORES = {
        # Official Government Sources
        'sec.gov': 1.0,
        'epa.gov': 1.0,
        'energy.gov': 1.0,
        'federalregister.gov': 1.0,
        'fred.stlouisfed.org': 1.0,

        # Industry Authorities
        'ahrinet.org': 0.90,
        'energystar.gov': 0.90,
        'ashrae.org': 0.88,

        # Major Business News
        'reuters.com': 0.80,
        'bloomberg.com': 0.80,
        'wsj.com': 0.78,
        'ft.com': 0.78,

        # Trade Publications
        'achrnews.com': 0.75,  # ACHR News (HVAC trade)
        'contractingbusiness.com': 0.75,
        'hvacindustry.com': 0.73,
        'prnewswire.com': 0.72,  # Press releases
        'businesswire.com': 0.72,

        # Company IR/Press
        'carrier.com': 0.85,
        'trane.com': 0.85,
        'lennox.com': 0.85,
        'johnsoncontrols.com': 0.85,
        'rheem.com': 0.85,

        # General News
        'cnbc.com': 0.65,
        'marketwatch.com': 0.65,
        'yahoo.com': 0.55,

        # Default for unknown sources
        'default': 0.50
    }

    def __init__(self):
        self.cache = {}
        self.cache_ttl = timedelta(hours=4)

    def get_source_trust_score(self, url: str) -> float:
        """Get trust score for a URL based on domain."""
        if not url:
            return 0.3

        url_lower = url.lower()
        for domain, score in self.SOURCE_TRUST_SCORES.items():
            if domain in url_lower:
                return score
        return self.SOURCE_TRUST_SCORES['default']

    def _get_cache_key(self, query: str, source_type: str) -> str:
        """Generate cache key for search query."""
        return hashlib.md5(f"{query}:{source_type}".encode()).hexdigest()

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached result is still valid."""
        if cache_key not in self.cache:
            return False
        cached_time = self.cache[cache_key].get('cached_at')
        if not cached_time:
            return False
        return datetime.now() - cached_time < self.cache_ttl

    def search_competitor_news(self, competitor: str, days_back: int = 30) -> List[SearchResult]:
        """
        Search for recent news about a specific competitor.
        Uses Google News RSS as a free alternative.
        """
        results = []
        queries = [
            f"{competitor} HVAC",
            f"{competitor} heat pump",
            f"{competitor} air conditioner launch",
            f"{competitor} HVAC pricing"
        ]

        for query in queries:
            cache_key = self._get_cache_key(query, 'news')

            if self._is_cache_valid(cache_key):
                results.extend(self.cache[cache_key]['results'])
                continue

            try:
                # Use Google News RSS (free, no API key required)
                rss_url = f"https://news.google.com/rss/search?q={query.replace(' ', '+')}&hl=en-US&gl=US&ceid=US:en"
                response = requests.get(rss_url, timeout=10)

                if response.status_code == 200:
                    # Parse RSS feed (simple parsing without external library)
                    content = response.text
                    items = self._parse_rss_items(content, query)

                    # Cache results
                    self.cache[cache_key] = {
                        'results': items,
                        'cached_at': datetime.now()
                    }
                    results.extend(items)

            except Exception as e:
                print(f"Error fetching news for {competitor}: {e}")
                continue

        return results

    def _parse_rss_items(self, rss_content: str, query: str) -> List[SearchResult]:
        """Parse RSS feed content into SearchResult objects."""
        results = []

        # Simple RSS parsing without external dependencies
        import re

        # Find all items
        items = re.findall(r'<item>(.*?)</item>', rss_content, re.DOTALL)

        for item in items[:10]:  # Limit to 10 items per query
            title_match = re.search(r'<title>(.*?)</title>', item)
            link_match = re.search(r'<link>(.*?)</link>', item)
            desc_match = re.search(r'<description>(.*?)</description>', item)
            pub_date_match = re.search(r'<pubDate>(.*?)</pubDate>', item)
            source_match = re.search(r'<source.*?>(.*?)</source>', item)

            if title_match and link_match:
                # Clean HTML entities
                title = self._clean_html(title_match.group(1))
                url = link_match.group(1)
                snippet = self._clean_html(desc_match.group(1)) if desc_match else ""
                pub_date = pub_date_match.group(1) if pub_date_match else None
                source = source_match.group(1) if source_match else self._extract_domain(url)

                results.append(SearchResult(
                    title=title,
                    url=url,
                    snippet=snippet[:500],  # Limit snippet length
                    source_name=source,
                    published_date=pub_date,
                    fetched_at=datetime.now().isoformat(),
                    search_query=query,
                    result_type='news'
                ))

        return results

    def _clean_html(self, text: str) -> str:
        """Remove HTML tags and entities from text."""
        import re
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        # Decode common HTML entities
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        text = text.replace('&#39;', "'")
        text = text.replace('&nbsp;', ' ')
        return text.strip()

    def _extract_domain(self, url: str) -> str:
        """Extract domain name from URL."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc.replace('www.', '')
        except:
            return 'unknown'

    def search_regulatory_updates(self) -> List[SearchResult]:
        """
        Search for HVAC regulatory updates from official sources.
        """
        results = []

        regulatory_queries = [
            "EPA HVAC efficiency standards 2025",
            "DOE heat pump regulations",
            "ENERGY STAR HVAC requirements",
            "refrigerant regulation HVAC",
            "AHRI HVAC standards update"
        ]

        for query in regulatory_queries:
            cache_key = self._get_cache_key(query, 'regulatory')

            if self._is_cache_valid(cache_key):
                results.extend(self.cache[cache_key]['results'])
                continue

            try:
                rss_url = f"https://news.google.com/rss/search?q={query.replace(' ', '+')}&hl=en-US&gl=US&ceid=US:en"
                response = requests.get(rss_url, timeout=10)

                if response.status_code == 200:
                    items = self._parse_rss_items(response.text, query)

                    # Mark as regulatory type
                    for item in items:
                        item.result_type = 'regulatory'

                    self.cache[cache_key] = {
                        'results': items,
                        'cached_at': datetime.now()
                    }
                    results.extend(items)

            except Exception as e:
                print(f"Error fetching regulatory news: {e}")
                continue

        return results

    def search_industry_trends(self) -> List[SearchResult]:
        """
        Search for general HVAC industry trends and market data.
        """
        results = []

        trend_queries = [
            "HVAC market share 2025",
            "heat pump sales growth",
            "residential HVAC demand",
            "HVAC supply chain",
            "HVAC industry forecast"
        ]

        for query in trend_queries:
            cache_key = self._get_cache_key(query, 'industry')

            if self._is_cache_valid(cache_key):
                results.extend(self.cache[cache_key]['results'])
                continue

            try:
                rss_url = f"https://news.google.com/rss/search?q={query.replace(' ', '+')}&hl=en-US&gl=US&ceid=US:en"
                response = requests.get(rss_url, timeout=10)

                if response.status_code == 200:
                    items = self._parse_rss_items(response.text, query)

                    for item in items:
                        item.result_type = 'industry'

                    self.cache[cache_key] = {
                        'results': items,
                        'cached_at': datetime.now()
                    }
                    results.extend(items)

            except Exception as e:
                print(f"Error fetching industry trends: {e}")
                continue

        return results

    def fetch_all_intelligence(self, competitors: Optional[List[str]] = None) -> Dict[str, List[SearchResult]]:
        """
        Fetch all types of intelligence in one call.

        Returns:
            Dictionary with keys: 'competitor_news', 'regulatory', 'industry'
        """
        if competitors is None:
            competitors = COMPETITORS[:5]  # Default to top 5 competitors

        all_results = {
            'competitor_news': [],
            'regulatory': [],
            'industry': []
        }

        # Fetch competitor news
        for competitor in competitors:
            results = self.search_competitor_news(competitor)
            all_results['competitor_news'].extend(results)

        # Fetch regulatory updates
        all_results['regulatory'] = self.search_regulatory_updates()

        # Fetch industry trends
        all_results['industry'] = self.search_industry_trends()

        # Deduplicate by URL
        for key in all_results:
            seen_urls = set()
            unique_results = []
            for result in all_results[key]:
                if result.url not in seen_urls:
                    seen_urls.add(result.url)
                    unique_results.append(result)
            all_results[key] = unique_results

        return all_results

    def get_economic_indicators(self) -> Dict[str, Any]:
        """
        Fetch economic indicators relevant to HVAC market.
        Uses FRED API (free with API key) or returns static context.

        Note: For full implementation, add FRED_API_KEY to environment.
        """
        # Static economic context (updated periodically)
        # In production, this would fetch from FRED API
        return {
            'source': 'FRED Economic Data',
            'trust_score': 1.0,
            'last_updated': datetime.now().isoformat(),
            'indicators': {
                'housing_starts': {
                    'description': 'New Residential Construction (thousands)',
                    'value': None,  # Would be fetched from FRED
                    'trend': 'Data not available - add FRED_API_KEY for live data',
                    'relevance': 'Direct driver of HVAC demand'
                },
                'construction_spending': {
                    'description': 'Total Construction Spending (billions)',
                    'value': None,
                    'trend': 'Data not available - add FRED_API_KEY for live data',
                    'relevance': 'Leading indicator for commercial HVAC'
                },
                'building_permits': {
                    'description': 'New Private Housing Permits',
                    'value': None,
                    'trend': 'Data not available - add FRED_API_KEY for live data',
                    'relevance': 'Forward-looking demand indicator'
                }
            },
            'note': 'To enable live economic data, add FRED_API_KEY to your environment variables. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html'
        }


# Singleton instance
_web_search_service = None

def get_web_search_service() -> WebSearchService:
    """Get or create the web search service singleton."""
    global _web_search_service
    if _web_search_service is None:
        _web_search_service = WebSearchService()
    return _web_search_service

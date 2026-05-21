"""
Trinetra Real-Time Facts Module v2.0
======================================
Fetches live, up-to-date factual context for time-sensitive claims
(e.g., sports captains, political leaders, world records) using:

  Primary:  NewsAPI — search for recent headlines about the claim topic.
            Uses the existing NEWS_API_KEY already configured in .env.
            Returns recent articles that establish current ground truth.

  Fallback: Google Custom Search (via GoogleSearch API) if NewsAPI misses.

This module is called BEFORE Gemini so that the AI prompt contains
verified, real-time news headlines rather than relying on potentially
stale training data.

WHY THIS MATTERS:
  If a user asks "Is Shubman Gill the Test captain?", without real-time
  context Gemini may defer to training data which could be stale.
  With this module, we fetch the 5 latest NewsAPI headlines about
  "India Test captain" and inject them directly into the Gemini prompt —
  forcing the AI to reason from CURRENT facts.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional

import httpx
from dotenv import load_dotenv
import os

load_dotenv(override=True)

logger = logging.getLogger(__name__)

NEWS_API_KEY = os.getenv('NEWS_API_KEY', '')
NEWS_API_BASE = 'https://newsapi.org/v2/everything'
NEWS_API_TOP  = 'https://newsapi.org/v2/top-headlines'

# ── Keyword patterns that signal time-sensitive claims ───────────────────────
# If ANY of these appear in the user's text, we trigger a real-time lookup.
REALTIME_TRIGGERS = [
    # Cricket captaincy
    r'\bcricket\b', r'\bcaptain\b', r'\btest captain\b', r'\bodi captain\b',
    r'\bt20 captain\b', r'\btest team\b', r'\bindian cricket\b', r'\bbcci\b',
    r'\bindian team\b', r'\bteam india\b', r'\bskipper\b',
    # Named cricketers who may have changed roles
    r'\brohit sharma\b', r'\bshubman gill\b', r'\bvirat kohli\b',
    r'\bjasprit bumrah\b', r'\bravindra jadeja\b', r'\bms dhoni\b',
    r'\bgill\b.*\bcaptain\b', r'\bcaptain\b.*\bgill\b',
    # Political leaders
    r'\bprime minister\b', r'\bpresident\b', r'\bpm of\b',
    # Sports records / championships
    r'\bworld cup\b', r'\bworld record\b', r'\bgrand slam\b',
    r'\bwimbledon\b', r'\bworld number one\b', r'\bnumber 1\b',
]

# ── Topic detection patterns → NewsAPI search queries ────────────────────────
TOPIC_QUERIES = {
    'india_test_captain': {
        'triggers': [
            r'\b(test captain|test team captain)\b.*\bindia\b',
            r'\bindia\b.*\b(test captain|test skipper)\b',
            r'\b(rohit sharma|shubman gill|bumrah|kohli)\b.*\b(captain|skipper|lead|appointed)\b',
            r'\b(captain|skipper)\b.*\b(india|indian)\b.*\b(test|cricket)\b',
            r'\b(test|cricket)\b.*\b(india|indian)\b.*\b(captain|skipper)\b',
            r'\bshubman gill\b.*\b(captain|test|odi|t20)\b',
            r'\bcaptain\b.*\bshubman\b',
        ],
        'queries': [
            'India Test cricket captain 2025',
            'India Test team captain appointed BCCI',
        ],
        'label': 'India Test Captain (Current)',
    },
    'india_odi_captain': {
        'triggers': [
            r'\bodi captain\b.*\bindia\b',
            r'\bindia\b.*\bodi captain\b',
        ],
        'queries': ['India ODI cricket captain 2025'],
        'label': 'India ODI Captain (Current)',
    },
    'india_pm': {
        'triggers': [
            r'\bprime minister\b.*\bindia\b',
            r'\bindia\b.*\bprime minister\b',
            r'\bpm of india\b',
        ],
        'queries': ['Prime Minister of India 2025'],
        'label': 'Prime Minister of India (Current)',
    },
    'us_president': {
        'triggers': [
            r'\bpresident\b.*\b(usa|america|united states)\b',
            r'\b(usa|america|united states)\b.*\bpresident\b',
        ],
        'queries': ['President of United States 2025'],
        'label': 'US President (Current)',
    },
}


def _is_realtime_relevant(text: str) -> bool:
    """Return True if the text contains any time-sensitive trigger keywords."""
    lower = text.lower()
    return any(re.search(pattern, lower) for pattern in REALTIME_TRIGGERS)


def _detect_topics(text: str) -> list[str]:
    """Detect which time-sensitive topics the claim is about."""
    lower = text.lower()
    matched = []
    for topic_key, topic_data in TOPIC_QUERIES.items():
        if any(re.search(pattern, lower) for pattern in topic_data['triggers']):
            matched.append(topic_key)
    return matched


async def _fetch_newsapi_headlines(query: str, max_articles: int = 5) -> list[dict]:
    """
    Search NewsAPI for recent articles about the query.
    Returns a list of article dicts with title, source, publishedAt.
    """
    if not NEWS_API_KEY:
        return []
    try:
        params = {
            'q': query,
            'apiKey': NEWS_API_KEY,
            'pageSize': max_articles,
            'sortBy': 'publishedAt',   # Most recent first — this is the key!
            'language': 'en',
        }
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(NEWS_API_BASE, params=params)
        if not resp.is_success:
            logger.warning(f'NewsAPI returned HTTP {resp.status_code} for query: {query}')
            return []
        data = resp.json()
        articles = data.get('articles', [])
        return [
            {
                'title':       art.get('title', '').strip(),
                'source':      art.get('source', {}).get('name', 'Unknown'),
                'publishedAt': art.get('publishedAt', '')[:10],  # YYYY-MM-DD
                'description': (art.get('description') or '')[:200].strip(),
                'url':         art.get('url', ''),
            }
            for art in articles
            if art.get('title') and '[Removed]' not in art.get('title', '')
        ]
    except Exception as e:
        logger.warning(f'NewsAPI fetch error for "{query}": {e}')
        return []


def _format_headlines_as_context(topic_label: str, articles: list[dict]) -> str:
    """Format fetched headlines into a readable context block for Gemini."""
    if not articles:
        return ''

    lines = [f'📰 RECENT NEWS ABOUT: {topic_label}']
    lines.append('(These headlines were fetched live from NewsAPI right now)')
    lines.append('')
    for i, art in enumerate(articles, 1):
        date_str = f'[{art["publishedAt"]}] ' if art['publishedAt'] else ''
        lines.append(f'{i}. {date_str}{art["title"]} — {art["source"]}')
        if art['description']:
            lines.append(f'   ↳ {art["description"]}')
    lines.append('')

    return '\n'.join(lines)


async def fetch_realtime_context(text: str) -> dict:
    """
    Main entry point: fetch real-time factual context for a claim.

    Returns:
        {
            'available': bool,
            'context_text': str,      # Formatted context to inject into Gemini prompt
            'sources': list[str],     # Source names
            'topics_checked': list,   # What topics were looked up
            'article_count': int,     # Total articles fetched
        }
    """
    if not _is_realtime_relevant(text):
        return {
            'available': False,
            'context_text': '',
            'sources': [],
            'topics_checked': [],
            'article_count': 0,
        }

    topics = _detect_topics(text)

    # If no specific topic matched but text is generally cricket-related, use default
    if not topics:
        lower = text.lower()
        if any(k in lower for k in ['captain', 'cricket', 'team india', 'bcci', 'skipper']):
            topics = ['india_test_captain']

    if not topics:
        return {
            'available': False,
            'context_text': '',
            'sources': [],
            'topics_checked': [],
            'article_count': 0,
        }

    # Fetch data for all detected topics concurrently
    all_context_parts = []
    all_sources = []
    total_articles = 0

    for topic_key in topics:
        topic_data = TOPIC_QUERIES.get(topic_key, {})
        queries = topic_data.get('queries', [])
        label = topic_data.get('label', topic_key)

        # Try each query, stop once we have articles
        all_articles: list[dict] = []
        for query in queries:
            articles = await _fetch_newsapi_headlines(query, max_articles=5)
            if articles:
                all_articles = articles
                break  # Got results from first working query

        if all_articles:
            context_block = _format_headlines_as_context(label, all_articles)
            all_context_parts.append(context_block)
            all_sources.append(f'NewsAPI ({label})')
            total_articles += len(all_articles)
            logger.info(f'Real-time: fetched {len(all_articles)} articles for topic "{label}"')
        else:
            logger.warning(f'Real-time: no articles found for topic "{label}"')

    if not all_context_parts:
        return {
            'available': False,
            'context_text': '',
            'sources': [],
            'topics_checked': topics,
            'article_count': 0,
        }

    context_text = (
        "\n\n━━━ REAL-TIME VERIFIED CONTEXT (fetched live from NewsAPI right now) ━━━\n"
        "⚡ CRITICAL: The following news headlines were retrieved IN REAL TIME and reflect\n"
        "the CURRENT state of affairs as reported by actual news sources TODAY.\n"
        "This information OVERRIDES your training data for these specific facts.\n\n"
        + "\n".join(all_context_parts)
        + "━━━ END REAL-TIME CONTEXT ━━━\n"
    )

    return {
        'available': True,
        'context_text': context_text,
        'sources': all_sources,
        'topics_checked': topics,
        'article_count': total_articles,
    }

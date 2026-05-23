"""
Trinetra Real-Time Facts Module v3.0
======================================
Fetches live, up-to-date factual context for time-sensitive claims
using NewsAPI sorted by publishedAt (most recent first).

Changes in v3.0:
  • GENERIC SEARCH: For ANY article/claim, we now always extract key
    named entities (people, places, organisations, events) and run a
    live NewsAPI search — not just the hardcoded topic list.
  • EXPANDED TRIGGERS: Covers elections, state assemblies, tech companies,
    IPO/finance, sports records, appointments, etc.
  • CURRENT DATE INJECTION: Every context block now includes today's date
    so Gemini knows exactly when "now" is and can reason accordingly.

WHY THIS MATTERS:
  "TSMC won Bengal 2026 election" — without this module Gemini had no
  knowledge of post-2025 events and defaulted to stale training data.
  With v3.0 we search NewsAPI for "TSMC Bengal election 2026" and inject
  real headlines into the prompt BEFORE Gemini generates its answer.
"""
from __future__ import annotations

import asyncio
import datetime
import logging
import re
from typing import Optional

import httpx
from dotenv import load_dotenv
import os

# Always load from the trinetra_ml/.env — regardless of uvicorn working directory
_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path=_ENV_PATH, override=True)

logger = logging.getLogger(__name__)

NEWS_API_KEY  = os.getenv('NEWS_API_KEY', '')
NEWS_API_BASE = 'https://newsapi.org/v2/everything'
NEWS_API_TOP  = 'https://newsapi.org/v2/top-headlines'

# Current date string injected into every context block
_TODAY = datetime.date.today().strftime('%B %d, %Y')   # e.g. "May 23, 2026"

# ── Keyword patterns that ALWAYS trigger a real-time NewsAPI lookup ───────────
# Much broader than v2.0 — covers elections, appointments, tech, finance, etc.
REALTIME_TRIGGERS = [
    # Cricket captaincy / sports leadership
    r'\bcricket\b', r'\bcaptain\b', r'\btest captain\b', r'\bodi captain\b',
    r'\bt20 captain\b', r'\btest team\b', r'\bindian cricket\b', r'\bbcci\b',
    r'\bindian team\b', r'\bteam india\b', r'\bskipper\b',
    # Named cricketers
    r'\brohit sharma\b', r'\bshubman gill\b', r'\bvirat kohli\b',
    r'\bjasprit bumrah\b', r'\bravindra jadeja\b', r'\bms dhoni\b',
    # ── Elections & politics (ANY election, ANY country, ANY state) ──
    r'\belection\b', r'\belections\b', r'\bwon\b.*\belection\b',
    r'\belection result\b', r'\bvoting\b', r'\bballot\b',
    r'\bprime minister\b', r'\bpresident\b', r'\bchief minister\b',
    r'\bcm of\b', r'\bpm of\b', r'\bgovernor\b', r'\bminister\b',
    r'\bparliament\b', r'\bsabha\b', r'\blok sabha\b', r'\brajya sabha\b',
    r'\bbjp\b', r'\bcongress\b', r'\baap\b', r'\btmc\b', r'\bdmk\b',
    r'\bappointed\b', r'\bsworn in\b', r'\bformed government\b',
    r'\bstate assembly\b', r'\bbengal\b', r'\bwest bengal\b',
    r'\buttar pradesh\b', r'\bup election\b', r'\bmaharashtra\b',
    r'\bbengal election\b', r'\bassembly election\b',
    # ── Technology companies & business events ──
    r'\btsmc\b', r'\bnvidia\b', r'\bintel\b', r'\bqualcomm\b',
    r'\bapple\b', r'\bgoogle\b', r'\bmeta\b', r'\bamazon\b',
    r'\bmicrosoft\b', r'\bsemiconductor\b', r'\bchip\b', r'\bipo\b',
    r'\bacquisition\b', r'\bmerger\b', r'\blaunch\b', r'\brelease\b',
    # ── Sports records / championships ──
    r'\bworld cup\b', r'\bworld record\b', r'\bgrand slam\b',
    r'\bwimbledon\b', r'\bworld number one\b', r'\bnumber 1\b',
    r'\bolympic\b', r'\bmedal\b', r'\bchampion\b', r'\btournament\b',
    # ── General time-sensitive keywords ──
    r'\b2024\b', r'\b2025\b', r'\b2026\b', r'\b2027\b',
    r'\brecently\b', r'\blast week\b', r'\bthis week\b', r'\btoday\b',
    r'\bcurrently\b', r'\blatest\b', r'\bnew\b', r'\bjust\b',
    r'\bannounced\b', r'\bconfirmed\b', r'\breported\b',
]

# ── Pre-defined high-precision topic queries ──────────────────────────────────
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
            f'India Test cricket captain {datetime.date.today().year}',
            'India Test team captain appointed BCCI',
        ],
        'label': f'India Test Captain (Current as of {_TODAY})',
    },
    'india_odi_captain': {
        'triggers': [
            r'\bodi captain\b.*\bindia\b',
            r'\bindia\b.*\bodi captain\b',
        ],
        'queries': [f'India ODI cricket captain {datetime.date.today().year}'],
        'label': f'India ODI Captain (Current as of {_TODAY})',
    },
    'india_pm': {
        'triggers': [
            r'\bprime minister\b.*\bindia\b',
            r'\bindia\b.*\bprime minister\b',
            r'\bpm of india\b',
        ],
        'queries': [f'Prime Minister of India {datetime.date.today().year}'],
        'label': f'Prime Minister of India (Current as of {_TODAY})',
    },
    'us_president': {
        'triggers': [
            r'\bpresident\b.*\b(usa|america|united states)\b',
            r'\b(usa|america|united states)\b.*\bpresident\b',
        ],
        'queries': [f'President of United States {datetime.date.today().year}'],
        'label': f'US President (Current as of {_TODAY})',
    },
    'bengal_election': {
        'triggers': [
            r'\b(bengal|west bengal)\b.*\belection\b',
            r'\belection\b.*\b(bengal|west bengal)\b',
            r'\bwb\b.*\belection\b',
            r'\bbengal\b.*\b(won|result|assembly|vote)\b',
        ],
        'queries': [
            f'West Bengal assembly election result {datetime.date.today().year}',
            f'Bengal election winner {datetime.date.today().year}',
        ],
        'label': f'West Bengal Election Result (as of {_TODAY})',
    },
    'india_state_elections': {
        'triggers': [
            r'\b(assembly election|state election|vidhan sabha)\b',
            r'\b(up|maharashtra|gujarat|rajasthan|karnataka|bihar|delhi|punjab|haryana)\b.*\belection\b',
            r'\belection\b.*\b(result|win|won|seat|majority)\b',
        ],
        'queries': [
            f'India state election results {datetime.date.today().year}',
            f'Assembly election winner {datetime.date.today().year} India',
        ],
        'label': f'India State Election Results (as of {_TODAY})',
    },
    'tsmc_india': {
        'triggers': [
            r'\btsmc\b.*\bindia\b',
            r'\bindia\b.*\btsmc\b',
            r'\btsmc\b.*\b(plant|fab|factory|semiconductor|chip)\b',
        ],
        'queries': [
            f'TSMC India semiconductor plant {datetime.date.today().year}',
            'TSMC India investment factory',
        ],
        'label': f'TSMC India (as of {_TODAY})',
    },
}


def _is_realtime_relevant(text: str) -> bool:
    """Return True if the text contains any time-sensitive trigger keywords."""
    lower = text.lower()
    return any(re.search(pattern, lower) for pattern in REALTIME_TRIGGERS)


def _detect_topics(text: str) -> list[str]:
    """Detect which pre-defined high-precision topics the claim is about."""
    lower = text.lower()
    matched = []
    for topic_key, topic_data in TOPIC_QUERIES.items():
        if any(re.search(pattern, lower) for pattern in topic_data['triggers']):
            matched.append(topic_key)
    return matched


def _build_generic_query(text: str) -> str:
    """
    Build a NewsAPI query from the raw claim/article text by extracting
    the most meaningful named terms (proper nouns, years, key nouns).
    Used as a fallback when no predefined topic matches.
    """
    # Strip punctuation except hyphens
    clean = re.sub(r'[^\w\s\-]', ' ', text[:600])
    words = clean.split()

    # Stop-words to skip
    STOP = {
        'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
        'in', 'of', 'to', 'for', 'with', 'that', 'this', 'was', 'are', 'be',
        'has', 'had', 'have', 'it', 'its', 'by', 'from', 'as', 'not', 'his',
        'her', 'they', 'their', 'said', 'says', 'will', 'would', 'could',
        'been', 'also', 'more', 'into', 'over', 'after', 'than', 'then',
        'when', 'where', 'who', 'what', 'how', 'our', 'we', 'you', 'i',
        'am', 'does', 'did', 'do', 'about', 'but', 'if', 'no', 'so', 'up',
    }

    # Prefer capitalised words (proper nouns / entity names) and year numbers
    priority = []
    others   = []
    for w in words:
        if len(w) <= 2:
            continue
        if w.lower() in STOP:
            continue
        if w[0].isupper() or re.match(r'^\d{4}$', w):   # proper noun or year
            priority.append(w)
        else:
            others.append(w.lower())

    # Build query: up to 6 priority words + 2 others
    query_words = priority[:6] + others[:2]
    return ' '.join(query_words) if query_words else text[:80]


async def _fetch_newsapi_headlines(query: str, max_articles: int = 5) -> list[dict]:
    """
    Search NewsAPI for recent articles about the query.
    Returns a list of article dicts with title, source, publishedAt.
    """
    if not NEWS_API_KEY:
        return []
    try:
        params = {
            'q':        query,
            'apiKey':   NEWS_API_KEY,
            'pageSize': max_articles,
            'sortBy':   'publishedAt',   # Most recent first — critical for real-time
            'language': 'en',
        }
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(NEWS_API_BASE, params=params)
        if not resp.is_success:
            logger.warning(f'NewsAPI returned HTTP {resp.status_code} for query: {query}')
            return []
        data     = resp.json()
        articles = data.get('articles', [])
        return [
            {
                'title':       art.get('title', '').strip(),
                'source':      art.get('source', {}).get('name', 'Unknown'),
                'publishedAt': art.get('publishedAt', '')[:10],   # YYYY-MM-DD
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
    lines.append(f'(Headlines fetched live from NewsAPI on {_TODAY})')
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
    Main entry point: fetch real-time factual context for any claim or article.

    Strategy (v3.0):
      1. Always run pre-defined topic queries that match (high-precision).
      2. ALWAYS also run a generic NewsAPI search using extracted named entities
         from the text — this catches events not in the hardcoded topic list
         (e.g., TSMC Bengal election, a new world record, a tech IPO, etc.)
      3. Inject today's date into every context block so Gemini knows the
         current date and doesn't reason from stale training knowledge.

    Returns:
        {
            'available': bool,
            'context_text': str,       # Formatted context to inject into Gemini
            'sources': list[str],      # Source names
            'topics_checked': list,    # What topics were looked up
            'article_count': int,      # Total articles fetched
        }
    """
    is_relevant = _is_realtime_relevant(text)

    # Even if no trigger fires, we still do a generic search for full articles
    # (≥ 400 chars) that might contain time-sensitive claims we don't have
    # triggers for.  For very short unrelated text (< 40 chars), skip.
    if not is_relevant and len(text.strip()) < 40:
        return {
            'available':      False,
            'context_text':   '',
            'sources':        [],
            'topics_checked': [],
            'article_count':  0,
        }

    all_context_parts: list[str] = []
    all_sources:        list[str] = []
    total_articles = 0
    topics_matched: list[str] = []

    # ── 1. Pre-defined topic queries (high precision) ─────────────────────────
    if is_relevant:
        topics = _detect_topics(text)

        # Default cricket fallback
        if not topics:
            lower = text.lower()
            if any(k in lower for k in ['captain', 'cricket', 'team india', 'bcci', 'skipper']):
                topics = ['india_test_captain']

        topics_matched = topics

        for topic_key in topics:
            topic_data = TOPIC_QUERIES.get(topic_key, {})
            queries    = topic_data.get('queries', [])
            label      = topic_data.get('label', topic_key)

            all_articles: list[dict] = []
            for query in queries:
                articles = await _fetch_newsapi_headlines(query, max_articles=5)
                if articles:
                    all_articles = articles
                    break

            if all_articles:
                context_block = _format_headlines_as_context(label, all_articles)
                all_context_parts.append(context_block)
                all_sources.append(f'NewsAPI ({label})')
                total_articles += len(all_articles)
                logger.info(f'Real-time [topic]: {len(all_articles)} articles for "{label}"')
            else:
                logger.warning(f'Real-time [topic]: no articles for "{label}"')

    # ── 2. Generic search — always runs for substantive text ─────────────────
    generic_query = _build_generic_query(text)
    if generic_query:
        generic_articles = await _fetch_newsapi_headlines(generic_query, max_articles=5)
        if generic_articles:
            label = f'General News Context (as of {_TODAY})'
            context_block = _format_headlines_as_context(label, generic_articles)
            all_context_parts.append(context_block)
            all_sources.append('NewsAPI (Generic Search)')
            total_articles += len(generic_articles)
            logger.info(f'Real-time [generic]: {len(generic_articles)} articles for "{generic_query}"')
        else:
            logger.info(f'Real-time [generic]: no results for "{generic_query}"')

    if not all_context_parts:
        return {
            'available':      False,
            'context_text':   '',
            'sources':        [],
            'topics_checked': topics_matched,
            'article_count':  0,
        }

    # ── 3. Assemble final context block with current date header ─────────────
    context_text = (
        f"\n\n━━━ REAL-TIME VERIFIED CONTEXT (fetched live on {_TODAY}) ━━━\n"
        f"📅 TODAY'S DATE: {_TODAY}  |  Current year: {datetime.date.today().year}\n"
        "⚡ CRITICAL: The news headlines below were retrieved IN REAL TIME from NewsAPI\n"
        "and reflect the CURRENT state of affairs as of TODAY.\n"
        "This information OVERRIDES your training data for these specific facts.\n"
        "If your training data conflicts with these headlines, TRUST THE HEADLINES.\n\n"
        + "\n".join(all_context_parts)
        + "━━━ END REAL-TIME CONTEXT ━━━\n"
    )

    return {
        'available':      True,
        'context_text':   context_text,
        'sources':        all_sources,
        'topics_checked': topics_matched,
        'article_count':  total_articles,
    }

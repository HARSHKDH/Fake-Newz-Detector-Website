"""
Trinetra AI Analyzer — Multi-Source Verification Engine
Combines Google Gemini AI with HuggingFace, Google Fact Check, NewsAPI,
and Reality Defender for a comprehensive authenticity analysis.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import httpx
from decouple import config
import google.generativeai as genai

# Ensure the ml directory is on sys.path so sibling modules resolve correctly
_ML_DIR = os.path.dirname(os.path.abspath(__file__))
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)

from verifiers import (  # noqa: E402
    check_huggingface,
    check_google_fact_check,
    check_news_api,
    check_reality_defender,
)

GEMINI_API_KEY = config('GEMINI_API_KEY', default='AIzaSyCjNusD2xkg8Iwzm_m9HOoki0sdQCGsCEo')

if GEMINI_API_KEY:
    genai.configure(api_key=AIzaSyCjNusD2xkg8Iwzm_m9HOoki0sdQCGsCEo)

# Composite score weights (must sum to 1.0)
WEIGHTS = {
    'gemini':       0.45,
    'huggingface':  0.20,
    'fact_check':   0.20,
    'news':         0.10,
    'reality_def':  0.05,
}


async def fetch_url_content(url: str) -> str:
    """Fetch and clean article text from a URL."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            resp.raise_for_status()
            # Re-sub always returns str when given str patterns, cast to be explicit
            text: str = str(re.sub(r'<[^>]+>', ' ', resp.text))
            text = str(re.sub(r'\s+', ' ', text)).strip()
            return text[:8000]
    except Exception as e:
        return f"Could not fetch URL content: {str(e)}"
    return ''  # unreachable but helps type checker see explicit str return path


def build_gemini_prompt(text: str) -> str:
    return f"""You are Trinetra AI, an expert fact-checking and news verification engine.

Analyze the following news content and respond with a JSON object ONLY — no markdown, no explanation outside the JSON.

News Content:
\"\"\"
{text[:6000]}
\"\"\"

Respond with this exact JSON structure:
{{
  "trust_score": <integer 0-100>,
  "verdict": "<one of: REAL | LIKELY_REAL | UNCERTAIN | LIKELY_FAKE | FAKE>",
  "verdict_label": "<one of: Verified Real | Likely Real | Uncertain | Likely Fake | Fake News>",
  "reasoning": "<2-4 sentence explanation of your verdict>",
  "source_analysis": "<analysis of the writing style, tone, and any source/bias indicators>",
  "key_claims": ["<claim 1>", "<claim 2>", "<claim 3>"],
  "red_flags": ["<red flag 1 if any>", "<red flag 2 if any>"]
}}

Scoring guide:
- 85-100: Credible, verifiable facts, established sources → REAL
- 65-84: Mostly credible, minor unverified claims → LIKELY_REAL
- 40-64: Mixed signals, unverified but plausible → UNCERTAIN
- 20-39: Multiple red flags, emotionally charged, poor sourcing → LIKELY_FAKE
- 0-19: Clear misinformation, fabricated quotes, false claims → FAKE

Be objective, thorough, and cite specific signals from the text.
"""


_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']

# Maximum seconds to wait per 429 quota error before trying next model.
# Keep short (<=15s) so the entire request stays under the 2-minute frontend timeout.
_MAX_QUOTA_WAIT = 12


def _parse_gemini_raw(raw: str) -> dict | None:
    """Parse raw Gemini text into a result dict. Returns None on failure."""
    if raw.startswith('```'):
        raw = re.sub(r'^```[a-z]*\n?', '', raw)
        raw = re.sub(r'\n?```$', '', raw)
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not match:
            return None
        try:
            result = json.loads(match.group())
        except Exception:
            return None
    result['trust_score'] = max(0, min(100, int(result.get('trust_score', 50))))
    result['key_claims']  = result.get('key_claims', [])[:5]
    result['red_flags']   = result.get('red_flags', [])[:5]
    return result


async def run_gemini(text: str) -> dict:
    """Call Gemini with automatic model fallback.

    Tries models in order: gemini-2.0-flash → gemini-1.5-flash → gemini-1.5-flash-8b.
    On a 429 quota error waits at most _MAX_QUOTA_WAIT seconds then moves to the
    next model immediately (previously waited up to 65 s, causing frontend timeouts).
    """
    if not GEMINI_API_KEY:
        return {
            'trust_score': 50, 'verdict': 'UNCERTAIN',
            'verdict_label': 'Uncertain',
            'reasoning': 'Gemini API key not configured.',
            'source_analysis': 'API key required.',
            'key_claims': [], 'red_flags': ['GEMINI_API_KEY not set'],
        }

    prompt = build_gemini_prompt(text)
    last_error = ''

    for model_name in _GEMINI_MODELS:
        try:
            model    = genai.GenerativeModel(model_name)
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, lambda m=model: m.generate_content(prompt)
                ),
                timeout=40,   # hard 40-second cap per model call
            )
            result = _parse_gemini_raw(response.text.strip())
            if result:
                return result
            # Parsing failed — try next model
            continue

        except asyncio.TimeoutError:
            last_error = f'{model_name} timed out after 40s'
            continue

        except Exception as e:
            err_str = str(e)
            last_error = err_str

            # Detect quota / rate-limit errors
            is_quota = '429' in err_str or 'quota' in err_str.lower() or 'rate' in err_str.lower()

            if is_quota:
                # Short wait then immediately try next model (don't retry same model)
                await asyncio.sleep(_MAX_QUOTA_WAIT)
            # Move to next model regardless of error type

    # All models exhausted
    return {
        'trust_score': 50, 'verdict': 'UNCERTAIN', 'verdict_label': 'Uncertain',
        'reasoning': (
            'Gemini AI could not complete the analysis. '
            'This is usually a temporary quota limit — please wait a moment and try again.'
        ),
        'source_analysis': 'Gemini AI temporarily unavailable.',
        'key_claims': [],
        'red_flags': [f'Gemini error: {str(last_error)[:120]}'],
    }


def compute_composite_score(gemini_score: int, hf: dict, fc: dict, news: dict, rd: dict) -> int:
    """Weighted composite trust score, skipping unavailable sources gracefully."""
    scores  = {'gemini': gemini_score}
    weights = {'gemini': WEIGHTS['gemini']}

    if hf.get('hf_available'):
        scores['huggingface'] = hf['hf_score']
        weights['huggingface'] = WEIGHTS['huggingface']

    if fc.get('fact_check_available') and fc.get('fact_check_count', 0) > 0:
        scores['fact_check'] = fc['fact_check_score']
        weights['fact_check'] = WEIGHTS['fact_check']

    if news.get('news_available'):
        scores['news'] = news['news_score']
        weights['news'] = WEIGHTS['news']

    if rd.get('rd_available'):
        scores['reality_def'] = rd['rd_score']
        weights['reality_def'] = WEIGHTS['reality_def']

    total_weight = sum(weights.values())
    composite = sum(scores[k] * weights[k] for k in scores) / total_weight
    return max(0, min(100, round(composite)))


def score_to_verdict(score: int) -> tuple[str, str]:
    if score >= 85:    return 'REAL',        'Verified Real'
    if score >= 65:    return 'LIKELY_REAL',  'Likely Real'
    if score >= 40:    return 'UNCERTAIN',    'Uncertain'
    if score >= 20:    return 'LIKELY_FAKE',  'Likely Fake'
    return 'FAKE', 'Fake News'


async def analyze_content(text: str | None = None, url: str | None = None) -> dict:
    """Main analysis — runs Gemini + all 4 verifiers in parallel, returns enriched result."""

    if url and not text:
        text = await fetch_url_content(url)

    if not text or len(text.strip()) < 20:
        return {
            'trust_score': 0, 'verdict': 'UNCERTAIN', 'verdict_label': 'Uncertain',
            'reasoning': 'Insufficient content to analyze.',
            'source_analysis': 'No content could be retrieved.',
            'key_claims': [], 'red_flags': ['Content too short or unavailable'],
            'fact_checks': [], 'news_sources': [],
            'sources_checked': [],
        }

    # Narrow type from str | None to str after the early-return guard above
    assert text is not None

    # ── Run all 5 sources in parallel ──────────────────────────────────
    gemini_result, hf, fc, news, rd = await asyncio.gather(
        run_gemini(text),
        check_huggingface(text),
        check_google_fact_check(text),
        check_news_api(text),
        check_reality_defender(text),
        return_exceptions=False,
    )
    # ───────────────────────────────────────────────────────────────────

    gemini_score = gemini_result.get('trust_score', 50)
    composite    = compute_composite_score(gemini_score, hf, fc, news, rd)
    verdict, verdict_label = score_to_verdict(composite)

    # Track which sources contributed
    sources_checked = ['Gemini AI']
    if hf.get('hf_available'):          sources_checked.append('HuggingFace NLP')
    if fc.get('fact_check_available'):  sources_checked.append('Google Fact Check')
    if news.get('news_available'):      sources_checked.append('NewsAPI')
    if rd.get('rd_available'):          sources_checked.append('Reality Defender')

    return {
        # Core Gemini analysis
        'trust_score':    composite,
        'verdict':        verdict,
        'verdict_label':  verdict_label,
        'reasoning':      gemini_result.get('reasoning', ''),
        'source_analysis': gemini_result.get('source_analysis', ''),
        'key_claims':     gemini_result.get('key_claims', []),
        'red_flags':      gemini_result.get('red_flags', []),
        # Per-source scores
        'gemini_score':       gemini_score,
        'hf_score':           hf.get('hf_score', 50),
        'hf_label':           hf.get('hf_label', 'UNKNOWN'),
        'hf_available':       hf.get('hf_available', False),
        'fact_check_score':   fc.get('fact_check_score', 50),
        'fact_checks':        fc.get('fact_checks', []),
        'fact_check_count':   fc.get('fact_check_count', 0),
        'fact_check_available': fc.get('fact_check_available', False),
        'news_score':         news.get('news_score', 50),
        'news_sources':       news.get('news_sources', []),
        'total_results':      news.get('total_results', 0),
        'trusted_count':      news.get('trusted_count', 0),
        'news_available':     news.get('news_available', False),
        'rd_score':           rd.get('rd_score', 50),
        'rd_available':       rd.get('rd_available', False),
        'rd_ai_generated':    rd.get('rd_ai_generated', False),
        'rd_ai_probability':  rd.get('rd_ai_probability', 0),
        # Summary
        'sources_checked': sources_checked,
    }

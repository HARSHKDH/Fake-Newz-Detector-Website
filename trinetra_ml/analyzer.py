"""
Trinetra AI Analyzer — Professional Fake News Detection Engine v5.0
=====================================================================
v5.0 — Real-Time Fact Checking:
  • SHORT CLAIM mode  (< 400 chars): Gemini verifies the claim. For time-sensitive
    facts (sports, politics, current events), live Wikipedia data is fetched FIRST
    and injected into the prompt — so Gemini reasons from real-time data, not stale
    training knowledge.
  • FULL ARTICLE mode (≥ 400 chars): Gemini evaluates journalistic quality, sourcing,
    and credibility signals, with real-time context injected where relevant.

KEY DESIGN: Training data is NEVER trusted for time-sensitive facts like captaincy,
leadership roles, or records. Wikipedia REST API provides live ground truth.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
import httpx
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv(override=True)

logger = logging.getLogger(__name__)

_ML_DIR  = os.path.dirname(os.path.abspath(__file__))
_ROOT_DIR = os.path.dirname(_ML_DIR)
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)

from trinetra_ml.verifiers import (  # noqa: E402
    check_huggingface,
    check_google_fact_check,
    check_news_api,
    check_reality_defender,
    check_domain_reputation,
)
from trinetra_ml.realtime_facts import fetch_realtime_context  # noqa: E402

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ── Weights per mode ──────────────────────────────────────────────────────────
# For SHORT CLAIMS: Gemini is the sole authority — other verifiers are unreliable
# for single-sentence inputs.
WEIGHTS_ARTICLE = {
    'gemini':      0.50,
    'domain':      0.25,
    'huggingface': 0.13,
    'fact_check':  0.10,
    'news':        0.02,
}

WEIGHTS_CLAIM = {
    'gemini':      0.80,   # Gemini's fact-knowledge dominates
    'fact_check':  0.15,   # Fact check API is useful for claim verification
    'news':        0.05,   # Some weak corroboration signal
}

# Threshold in characters to distinguish a single claim vs a full article
CLAIM_THRESHOLD = 400


async def fetch_url_content(url: str) -> str:
    """Fetch and clean article text from a URL."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            resp.raise_for_status()
            text: str = str(re.sub(r'<[^>]+>', ' ', resp.text))
            text = str(re.sub(r'\s+', ' ', text)).strip()
            return text[:8000]
    except Exception as e:
        return f"Could not fetch URL content: {str(e)}"


def _detect_mode(text: str) -> str:
    """Return 'claim' for short factual statements, 'article' for full news articles."""
    stripped = text.strip()
    if len(stripped) < CLAIM_THRESHOLD:
        return 'claim'
    # Also treat as claim if it's a few sentences with no paragraph structure
    sentences = [s.strip() for s in re.split(r'[.!?]+', stripped) if s.strip()]
    if len(sentences) <= 3 and len(stripped) < 600:
        return 'claim'
    return 'article'


def build_gemini_prompt_claim(text: str, realtime_context: str = '') -> str:
    """
    Prompt for SHORT FACTUAL CLAIMS.
    Gemini uses its internal knowledge + injected real-time context to verify whether
    the claim is true. Does NOT penalise for lack of sourcing.
    """
    realtime_block = ''
    if realtime_context:
        realtime_block = f"""
{realtime_context}
⚠️  CRITICAL INSTRUCTION: The REAL-TIME CONTEXT above was fetched live from Wikipedia
right now and reflects the CURRENT, UP-TO-DATE state of the world.
You MUST prioritize this real-time context over your training data when they conflict.
If the real-time context says X is the captain and the claim says Y is the captain,
and X ≠ Y, the claim is FALSE — score it below 40.
"""
    return f"""You are Trinetra, an expert fact-checking AI with comprehensive knowledge of world events, politics, sports, science, and current affairs.

A user has submitted a SHORT FACTUAL CLAIM for verification. Your job is to determine if this claim is TRUE or FALSE.
{realtime_block}
CLAIM TO VERIFY:
\"\"\"{text.strip()}\"\"\"

INSTRUCTIONS:
1. If REAL-TIME CONTEXT is provided above, use it as your PRIMARY source of truth — it is live data.
2. Your training data is a SECONDARY source, especially for time-sensitive facts like sports captaincy,
   leadership roles, records, and recent appointments which change frequently.
3. Do NOT penalise for lack of sources — this is a fact check, not an article review.
4. Do NOT apply journalism quality checks — apply FACTUAL ACCURACY checks.

SCORING GUIDE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 90-100 → Claim is DEFINITIVELY TRUE and confirmed by real-time data or well-established fact.
           Example: "The Earth orbits the Sun" → 99
           Example: "Sachin Tendulkar scored 100 international centuries" → 96

• 70-89  → Claim is LIKELY TRUE — supported by available data but with minor uncertainty.

• 45-69  → Claim is UNCERTAIN — cannot confirm or deny with confidence.
           Example: "India won the match yesterday" → 50 (no context available)

• 20-44  → Claim is LIKELY FALSE — contradicts real-time data or known facts.

• 0-19   → Claim is DEFINITIVELY FALSE — clearly contradicts established/live facts.
           Example: "The Moon is made of cheese" → 2
           Example: "India has never won a cricket World Cup" → 5

CRITICAL RULES:
- If REAL-TIME CONTEXT is present and the claim contradicts it → score BELOW 40.
- If REAL-TIME CONTEXT confirms the claim → score ABOVE 80.
- If the claim is factually correct per your knowledge and no context contradicts it → score 80+.
- If genuinely unknown/ambiguous → score 45-60.
- Do NOT use hardcoded examples from training — reason about THIS specific claim.

Respond ONLY with valid JSON:
{{
  "trust_score": <integer 0-100>,
  "verdict": "<REAL | LIKELY_REAL | UNCERTAIN | LIKELY_FAKE | FAKE>",
  "verdict_label": "<Verified Real | Likely Real | Uncertain | Likely Fake | Fake News>",
  "reasoning": "<2-3 sentences explaining why this claim is true/false/uncertain, mentioning real-time data if used>",
  "source_analysis": "<What real-time data and/or training knowledge supports this verdict>",
  "detected_source": "User-submitted claim",
  "key_claims": ["{text.strip()[:120]}"],
  "red_flags": [],
  "credibility_signals": []
}}
"""


def build_gemini_prompt_article(text: str, domain_info: str = '') -> str:
    """
    Prompt for FULL NEWS ARTICLES.
    Evaluates journalistic quality, source credibility, and factual consistency.
    """
    domain_context = f"\nSOURCE DOMAIN: {domain_info}" if domain_info else ''
    return f"""You are Trinetra, an elite professional fact-checking AI. Analyze this news article and return a DECISIVE verdict. Avoid the 55-70 fence zone unless truly ambiguous.
{domain_context}

NEWS ARTICLE:
\"\"\"{text[:5500]}\"\"\"

SCORING RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ 85-100 (REAL): Named verifiable sources, specific attributable facts, professional journalism, consistent with public record, known credible outlet.

▶ 65-84 (LIKELY_REAL): Mostly credible, 1-2 minor unverified details, reputable style.

▶ 40-64 (UNCERTAIN): Genuine mix of credible and suspicious signals. Opinion pieces. Cannot determine.

▶ 20-39 (LIKELY_FAKE): Anonymous sources as primary evidence, sensational inconsistent headline, unverified statistics, contradicts public record, propaganda style.

▶ 0-19 (FAKE): Fabricated quotes, conspiracy framing, "share before deleted" tactics, completely false claims, known hoax patterns.

CRITICAL: Be DECISIVE. Journalism with named sources → 80+. Red flags present → below 50. DO NOT give 55-65 to everything.

Respond ONLY with valid JSON:
{{
  "trust_score": <integer 0-100>,
  "verdict": "<REAL | LIKELY_REAL | UNCERTAIN | LIKELY_FAKE | FAKE>",
  "verdict_label": "<Verified Real | Likely Real | Uncertain | Likely Fake | Fake News>",
  "reasoning": "<3-5 sentences citing specific evidence from the text>",
  "source_analysis": "<analysis of sourcing quality, named sources, writing style, bias indicators>",
  "detected_source": "<publication name or domain if identifiable, else 'Unknown'>",
  "key_claims": ["<claim 1>", "<claim 2>", "<claim 3>"],
  "red_flags": ["<red flag if any>"],
  "credibility_signals": ["<positive signal if any>"]
}}
"""


_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
_MAX_QUOTA_WAIT = 10


def _parse_gemini_raw(raw: str) -> dict | None:
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

    score = int(result.get('trust_score', 50))
    result['trust_score'] = max(0, min(100, score))

    # Enforce score-verdict consistency
    verdict = result.get('verdict', 'UNCERTAIN').upper()
    s = result['trust_score']
    if verdict == 'REAL'        and s < 85:              result['trust_score'] = max(s, 85)
    if verdict == 'LIKELY_REAL' and not (65 <= s < 85):  result['trust_score'] = max(65, min(s, 84))
    if verdict == 'UNCERTAIN'   and not (40 <= s < 65):  result['trust_score'] = max(40, min(s, 64))
    if verdict == 'LIKELY_FAKE' and not (20 <= s < 40):  result['trust_score'] = max(20, min(s, 39))
    if verdict == 'FAKE'        and s >= 20:             result['trust_score'] = min(s, 19)

    result['key_claims']          = result.get('key_claims', [])[:5]
    result['red_flags']           = result.get('red_flags', [])[:5]
    result['credibility_signals'] = result.get('credibility_signals', [])[:5]
    return result


async def run_gemini(text: str, domain_info: str = '', mode: str = 'article', realtime_context: str = '') -> dict:
    """Call Gemini with the appropriate prompt for the detected mode.
    
    Args:
        text: The content to analyze.
        domain_info: Domain name if content came from a URL.
        mode: 'claim' or 'article'.
        realtime_context: Live-fetched factual context to inject into the prompt.
    """
    if not GEMINI_API_KEY:
        return {
            'trust_score': 50, 'verdict': 'UNCERTAIN',
            'verdict_label': 'Uncertain',
            'reasoning': 'Gemini API key not configured.',
            'source_analysis': 'API key required.',
            'detected_source': 'Unknown',
            'key_claims': [], 'red_flags': [], 'credibility_signals': [],
        }

    if mode == 'claim':
        prompt = build_gemini_prompt_claim(text, realtime_context=realtime_context)
    else:
        # For articles, append real-time context at the end of the article prompt if available
        article_prompt = build_gemini_prompt_article(text, domain_info)
        if realtime_context:
            prompt = article_prompt.replace(
                'Respond ONLY with valid JSON:',
                f'{realtime_context}\n⚠️ Use the REAL-TIME CONTEXT above to correct any stale facts in your scoring.\n\nRespond ONLY with valid JSON:'
            )
        else:
            prompt = article_prompt

    last_error = ''
    for model_name in _GEMINI_MODELS:
        try:
            model    = genai.GenerativeModel(model_name)
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, lambda m=model: m.generate_content(prompt)
                ),
                timeout=45,
            )
            result = _parse_gemini_raw(response.text.strip())
            if result:
                result['_mode'] = mode   # tag for downstream use
                return result
            continue

        except asyncio.TimeoutError:
            last_error = f'{model_name} timed out'
            continue
        except Exception as e:
            err_str = str(e)
            last_error = err_str
            if '429' in err_str or 'quota' in err_str.lower():
                await asyncio.sleep(_MAX_QUOTA_WAIT)

    return {
        'trust_score': 50, 'verdict': 'UNCERTAIN', 'verdict_label': 'Uncertain',
        'reasoning': 'Gemini AI temporarily unavailable. Please retry in a moment.',
        'source_analysis': 'Gemini AI temporarily unavailable.',
        'detected_source': 'Unknown',
        'key_claims': [],
        'red_flags': [f'Gemini error: {str(last_error)[:120]}'],
        'credibility_signals': [],
        '_mode': mode,
    }


def compute_composite_score(
    gemini_score: int,
    domain: dict,
    hf: dict,
    fc: dict,
    news: dict,
    rd: dict,
    mode: str = 'article',
) -> int:
    """
    Smart weighted composite.
    - CLAIM mode: Gemini (80%) + Fact Check (15%) + NewsAPI (5%).
      HuggingFace is EXCLUDED for claims — the NLP model is trained on articles,
      not single-sentence facts, so it gives unreliable results for short input.
    - ARTICLE mode: Full multi-source weighted composite.
    - Known fake sites always hard-capped.
    """
    # ── Hard gate: known misinformation site ──────────────────────────────────
    if domain.get('is_known_fake_site'):
        return max(0, min(22, round(gemini_score * 0.35)))

    # ── CLAIM MODE: Gemini is almost everything ───────────────────────────────
    if mode == 'claim':
        scores  = {'gemini': gemini_score}
        weights = {'gemini': WEIGHTS_CLAIM['gemini']}

        # Fact check — if it found matching claims, use it
        if fc.get('fact_check_available') and fc.get('fact_check_count', 0) > 0:
            fc_score = fc.get('fact_check_score', 50)
            if abs(fc_score - 50) >= 10:
                scores['fact_check']  = fc_score
                weights['fact_check'] = WEIGHTS_CLAIM['fact_check']

        # NewsAPI — only if strong corroboration (≥3 trusted sources) or zero coverage
        news_score = news.get('news_score') if news.get('news_available') else None
        if news_score is not None:
            if news_score >= 70:   # Strong trusted-source corroboration
                scores['news']  = news_score
                weights['news'] = WEIGHTS_CLAIM['news']
            elif news_score <= 25: # Zero coverage — slight negative signal
                scores['news']  = news_score
                weights['news'] = WEIGHTS_CLAIM['news']

        total_weight = sum(weights[k] for k in scores)
        composite = sum(scores[k] * weights[k] for k in scores) / total_weight

        # Band enforcement for claims: trust Gemini's fact-knowledge
        if gemini_score >= 85:
            composite = max(composite, 82)   # true well-known fact → stays high
        elif gemini_score >= 65:
            composite = max(composite, 62)
        elif gemini_score < 40:
            composite = min(composite, 44)   # false claim → stays low

        return max(0, min(100, round(composite)))

    # ── ARTICLE MODE: full multi-source composite ─────────────────────────────
    scores  = {'gemini': gemini_score}
    weights = {'gemini': WEIGHTS_ARTICLE['gemini']}

    domain_score = domain.get('domain_score')
    if domain.get('domain_available') and domain_score is not None:
        scores['domain']  = domain_score
        weights['domain'] = WEIGHTS_ARTICLE['domain']

    hf_score = hf.get('hf_score') if hf.get('hf_available') else None
    if hf_score is not None and abs(hf_score - 50) >= 15:
        scores['huggingface']  = hf_score
        weights['huggingface'] = WEIGHTS_ARTICLE['huggingface']

    if fc.get('fact_check_available') and fc.get('fact_check_count', 0) > 0:
        fc_score = fc.get('fact_check_score', 50)
        if abs(fc_score - 50) >= 10:
            scores['fact_check']  = fc_score
            weights['fact_check'] = WEIGHTS_ARTICLE['fact_check']

    news_score = news.get('news_score') if news.get('news_available') else None
    if news_score is not None and news_score <= 25:
        scores['news']  = news_score
        weights['news'] = WEIGHTS_ARTICLE['news']

    total_weight = sum(weights[k] for k in scores)
    if total_weight == 0:
        return gemini_score

    composite = sum(scores[k] * weights[k] for k in scores) / total_weight

    # Band enforcement
    if gemini_score >= 85:
        composite = max(composite, 72)
        composite = min(composite, 100)
    elif gemini_score >= 65:
        composite = max(composite, 60)
        composite = min(composite, 88)
    elif gemini_score >= 40:
        composite = max(composite, 35)
        composite = min(composite, 64)
    elif gemini_score >= 20:
        composite = min(composite, 44)
        composite = max(composite, 18)
    else:
        composite = min(composite, 22)

    # HuggingFace contradiction penalty (articles only)
    if hf_score is not None and hf_score < 30 and composite > 55:
        composite -= 20

    # Bonus: high-trust domain + NLP agreement
    if domain_score and domain_score >= 90 and hf_score and hf_score >= 75:
        composite = min(100, composite + 5)

    return max(0, min(100, round(composite)))


def score_to_verdict(score: int) -> tuple[str, str]:
    if score >= 85: return 'REAL',        'Verified Real'
    if score >= 65: return 'LIKELY_REAL', 'Likely Real'
    if score >= 40: return 'UNCERTAIN',   'Uncertain'
    if score >= 20: return 'LIKELY_FAKE', 'Likely Fake'
    return 'FAKE', 'Fake News'


async def analyze_content(text: str | None = None, url: str | None = None) -> dict:
    """Main analysis entry point — auto-detects claim vs article mode.
    
    For time-sensitive claims (sports captains, political leaders, etc.),
    real-time Wikipedia data is fetched FIRST and injected into the Gemini
    prompt so the AI reasons from live data, not stale training knowledge.
    """

    domain_info_str = ''
    if url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain_info_str = parsed.netloc.replace('www.', '')
        except Exception:
            pass

    if url and not text:
        text = await fetch_url_content(url)

    if not text or len(text.strip()) < 5:
        return {
            'trust_score': 0, 'verdict': 'UNCERTAIN', 'verdict_label': 'Uncertain',
            'reasoning': 'Insufficient content to analyze.',
            'source_analysis': 'No content could be retrieved.',
            'detected_source': domain_info_str or 'Unknown',
            'key_claims': [], 'red_flags': ['Content too short or unavailable'],
            'credibility_signals': [],
            'fact_checks': [], 'news_sources': [],
            'sources_checked': [], 'input_mode': 'unknown',
        }

    assert text is not None

    # ── Detect mode — URL content is always treated as an article ─────────────
    mode = 'article' if url else _detect_mode(text)

    # ── Fetch real-time context FIRST (for time-sensitive claims) ─────────────
    # This runs BEFORE Gemini so live facts can be injected into the prompt.
    realtime_data = await fetch_realtime_context(text)
    realtime_context = realtime_data.get('context_text', '')
    realtime_sources = realtime_data.get('sources', [])
    if realtime_data.get('available'):
        logger.info(f'Real-time context fetched from: {realtime_sources}')
    else:
        logger.info('No real-time context needed for this content.')

    # ── Run verifiers in parallel ─────────────────────────────────────────────
    gemini_result, domain, hf, fc, news, rd = await asyncio.gather(
        run_gemini(text, domain_info_str, mode=mode, realtime_context=realtime_context),
        check_domain_reputation(url or ''),
        check_huggingface(text),
        check_google_fact_check(text),
        check_news_api(text),
        check_reality_defender(text),
        return_exceptions=False,
    )

    gemini_score = gemini_result.get('trust_score', 50)
    composite    = compute_composite_score(gemini_score, domain, hf, fc, news, rd, mode=mode)
    verdict, verdict_label = score_to_verdict(composite)

    detected_source = gemini_result.get('detected_source') or domain_info_str or 'Unknown'

    sources_checked = [f'Gemini AI ({mode} mode)']
    if realtime_data.get('available'):   sources_checked.extend([f'🌐 {s}' for s in realtime_sources])
    if domain.get('domain_available'):   sources_checked.append('Domain Reputation')
    if hf.get('hf_available') and mode == 'article':
        sources_checked.append('HuggingFace NLP')
    if fc.get('fact_check_available'):   sources_checked.append('Google Fact Check')
    if news.get('news_available'):       sources_checked.append('NewsAPI')
    if rd.get('rd_available'):           sources_checked.append('Reality Defender')

    return {
        # Core
        'trust_score':         composite,
        'verdict':             verdict,
        'verdict_label':       verdict_label,
        'reasoning':           gemini_result.get('reasoning', ''),
        'source_analysis':     gemini_result.get('source_analysis', ''),
        'detected_source':     detected_source,
        'key_claims':          gemini_result.get('key_claims', []),
        'red_flags':           gemini_result.get('red_flags', []),
        'credibility_signals': gemini_result.get('credibility_signals', []),
        'input_mode':          mode,
        # Per-source scores
        'gemini_score':         gemini_score,
        'domain_score':         domain.get('domain_score', 50),
        'domain_available':     domain.get('domain_available', False),
        'domain_reputation':    domain.get('domain_reputation', 'Unknown'),
        'domain_category':      domain.get('domain_category', ''),
        'is_known_fake_site':   domain.get('is_known_fake_site', False),
        'hf_score':             hf.get('hf_score', 50),
        'hf_label':             hf.get('hf_label', 'UNKNOWN'),
        'hf_available':         hf.get('hf_available', False),
        'fact_check_score':     fc.get('fact_check_score', 50),
        'fact_checks':          fc.get('fact_checks', []),
        'fact_check_count':     fc.get('fact_check_count', 0),
        'fact_check_available': fc.get('fact_check_available', False),
        'news_score':           news.get('news_score', 50),
        'news_sources':         news.get('news_sources', []),
        'total_results':        news.get('total_results', 0),
        'trusted_count':        news.get('trusted_count', 0),
        'news_available':       news.get('news_available', False),
        'rd_score':             rd.get('rd_score', 50),
        'rd_available':         rd.get('rd_available', False),
        'rd_ai_generated':      rd.get('rd_ai_generated', False),
        'rd_ai_probability':    rd.get('rd_ai_probability', 0),
        'sources_checked':      sources_checked,
    }

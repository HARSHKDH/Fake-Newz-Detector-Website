"""
Trinetra Multi-Source Verifiers v2.0
Parallel verification: Domain Reputation, HuggingFace, Google Fact Check,
NewsAPI, and AI-content detection.
Each verifier returns a dict with a *_score (0-100) and metadata.
All functions are safe — they never raise; they return neutral results on failure.
"""
import asyncio
import re
import logging
from urllib.parse import urlparse
import httpx
from dotenv import load_dotenv
import os

load_dotenv(override=True)

logger = logging.getLogger(__name__)

HUGGINGFACE_API_KEY       = os.getenv('HUGGINGFACE_API_KEY', '')
GOOGLE_FACT_CHECK_API_KEY = os.getenv('GOOGLE_FACT_CHECK_API_KEY', '')
NEWS_API_KEY              = os.getenv('NEWS_API_KEY', '')
REALITY_DEFENDER_API_KEY  = os.getenv('REALITY_DEFENDER_API_KEY', '')
SAPLING_API_KEY           = os.getenv('SAPLING_API_KEY', '')


# ─────────────────────────────────────────────────────────────────────────────
# 0. DOMAIN REPUTATION DATABASE
# ─────────────────────────────────────────────────────────────────────────────

# Tier 1 — Highly trusted mainstream journalism
TIER1_TRUSTED = {
    'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'npr.org',
    'nytimes.com', 'theguardian.com', 'washingtonpost.com', 'bloomberg.com',
    'wsj.com', 'economist.com', 'ft.com', 'time.com', 'theatlantic.com',
    'newyorker.com', 'politico.com', 'axios.com', 'thehill.com',
    'usatoday.com', 'nbcnews.com', 'cbsnews.com', 'abcnews.go.com',
    'cnn.com', 'aljazeera.com', 'france24.com', 'dw.com', 'euronews.com',
    # Indian trusted outlets
    'thehindu.com', 'ndtv.com', 'hindustantimes.com', 'indianexpress.com',
    'timesofindia.indiatimes.com', 'theprint.in', 'thewire.in', 'scroll.in',
    'livemint.com', 'businessstandard.com', 'economictimes.indiatimes.com',
    'firstpost.com', 'news18.com', 'indiatoday.in',
    # Science & fact-checking
    'snopes.com', 'factcheck.org', 'politifact.com', 'fullfact.org',
    'boomlive.in', 'altnews.in', 'vishvasnews.com', 'newsmobile.in',
    'sciencemag.org', 'nature.com', 'who.int', 'cdc.gov', 'nih.gov',
}

# Tier 2 — Reputable but sometimes partisan/opinion-heavy
TIER2_REPUTABLE = {
    'vox.com', 'slate.com', 'salon.com', 'huffpost.com', 'buzzfeednews.com',
    'motherjones.com', 'thenation.com', 'nationalreview.com', 'reason.com',
    'theintercept.com', 'propublica.org', 'fivethirtyeight.com',
    'foreignpolicy.com', 'foreignaffairs.com', 'thedailybeast.com',
    'dailymail.co.uk', 'telegraph.co.uk', 'thesun.co.uk', 'mirror.co.uk',
    'nypost.com', 'foxnews.com', 'breitbart.com',
    # Indian Tier 2
    'opindia.com', 'swarajyamag.com', 'newslaundry.com', 'thequint.com',
    'wire.in', 'tribuneindia.com', 'deccanherald.com', 'thestatesman.com',
    'telegraphindia.com', 'theweek.in', 'outlookindia.com', 'frontline.in',
}

# Known FAKE NEWS / MISINFORMATION / SATIRE sites
KNOWN_FAKE_SITES = {
    # International fake news
    'naturalnews.com', 'infowars.com', 'beforeitsnews.com', 'worldnewsdailyreport.com',
    'empirenews.net', 'nationalreport.net', 'huzlers.com', 'theonion.com',
    'babylonbee.com', 'clickhole.com', 'worldpoliticus.com', 'abcnews.com.co',
    'cbsnews.com.co', 'nbc.com.co', 'usatoday.com.co', 'washingtonpost.com.co',
    'nytimes.com.co', 'cnn-trending.com', 'cnn.com.de', 'cnnnews24.com',
    'denverpost.com.co', 'bostontribune.com', 'realfreenews.com',
    'conservativedailypost.com', 'americannews.com', 'topinfopost.com',
    'patreontruth.com', 'yournewswire.com', 'newspunch.com', 'wakingtimes.com',
    'abovetopsecret.com', 'veteranstoday.com', 'globalresearch.ca',
    'zerohedge.com', 'thetruthseeker.co.uk', 'davidicke.com',
    'chemtrailsplanet.net', 'geoengineeringwatch.org', 'activistpost.com',
    'fellowshipofminds.com', 'thedailysheeple.com', 'shtfplan.com',
    'survivopedia.com', 'whatreallyhappened.com', 'rense.com',
    'prisonplanet.com', 'politicususa.com', 'addictinginfo.com',
    'occupydemocrats.com', 'forwardprogressives.com', 'politicalblindspot.com',
    'realclearpolitics.com', 'rightwingwatch.org', 'rightnationpolitics.com',
    'freedomoutpost.com', 'redstatewatcher.com', 'teaparty.org',
    'patriotupdate.com', 'libertynews.com', 'libertydailyreport.com',
    # Indian fake news / misinformation sites
    'postcard.news', 'thecircle.co.in', 'newstrend.news', 'khabarfast.com',
    'viral-news24.com', 'rstv.nic.in', 'pib.gov.in.co', 'pibindia.com',
    'forwardpress.in',
    # Fake URL typosquatters
    'abcnews.go.com.co', 'foxnews.com.co', 'msnbc.com.co',
}


def _extract_domain(url: str) -> str:
    """Extract clean domain (no www, no subpath) from a URL."""
    try:
        parsed = urlparse(url if url.startswith('http') else f'https://{url}')
        domain = parsed.netloc.lower().replace('www.', '').replace('www2.', '')
        # Remove port if present
        domain = domain.split(':')[0]
        return domain
    except Exception:
        return ''


async def check_domain_reputation(url: str) -> dict:
    """Check the reputation of the source domain.

    Returns a trust score based on domain reputation:
    - Known trusted outlets → high score (85-95)
    - Reputable but partisan outlets → moderate score (60-75)
    - Unknown/neutral domains → 50 (excluded from composite)
    - Known fake-news/misinformation sites → very low score (5-15) + hard flag
    """
    if not url or not url.strip():
        return {
            'domain_available': False,
            'domain_score': None,
            'domain_reputation': 'No URL provided',
            'domain_category': 'text_only',
            'is_known_fake_site': False,
        }

    domain = _extract_domain(url)
    if not domain:
        return {
            'domain_available': False,
            'domain_score': None,
            'domain_reputation': 'Could not parse domain',
            'domain_category': 'unknown',
            'is_known_fake_site': False,
        }

    # Check for exact match first, then parent domain
    def _match(domain_set: set, d: str) -> bool:
        if d in domain_set:
            return True
        # Check parent domain (e.g. 'sports.ndtv.com' → 'ndtv.com')
        parts = d.split('.')
        for i in range(1, len(parts) - 1):
            parent = '.'.join(parts[i:])
            if parent in domain_set:
                return True
        return False

    if _match(KNOWN_FAKE_SITES, domain):
        return {
            'domain_available': True,
            'domain_score': 8,
            'domain_reputation': f'⚠️ KNOWN MISINFORMATION SITE: {domain}',
            'domain_category': 'known_fake',
            'is_known_fake_site': True,
            'domain': domain,
        }

    if _match(TIER1_TRUSTED, domain):
        return {
            'domain_available': True,
            'domain_score': 92,
            'domain_reputation': f'✅ Verified Trusted Outlet: {domain}',
            'domain_category': 'tier1_trusted',
            'is_known_fake_site': False,
            'domain': domain,
        }

    if _match(TIER2_REPUTABLE, domain):
        return {
            'domain_available': True,
            'domain_score': 68,
            'domain_reputation': f'🔵 Reputable Outlet (may be partisan): {domain}',
            'domain_category': 'tier2_reputable',
            'is_known_fake_site': False,
            'domain': domain,
        }

    # Unknown domain — check basic signals (HTTPS, no IP address, .gov/.edu)
    is_gov_edu = domain.endswith('.gov') or domain.endswith('.edu') or domain.endswith('.ac.in') or domain.endswith('.ac.uk')
    has_ip     = bool(re.match(r'^\d+\.\d+\.\d+\.\d+$', domain))

    if is_gov_edu:
        return {
            'domain_available': True,
            'domain_score': 82,
            'domain_reputation': f'✅ Official Government/Education source: {domain}',
            'domain_category': 'official',
            'is_known_fake_site': False,
            'domain': domain,
        }

    if has_ip:
        return {
            'domain_available': True,
            'domain_score': 15,
            'domain_reputation': f'⚠️ IP address URL — highly suspicious: {domain}',
            'domain_category': 'suspicious_ip',
            'is_known_fake_site': False,
            'domain': domain,
        }

    # Truly unknown domain — return as unavailable so composite excludes it
    return {
        'domain_available': False,  # Exclude neutral unknowns from composite
        'domain_score': None,
        'domain_reputation': f'Unknown domain: {domain}',
        'domain_category': 'unknown',
        'is_known_fake_site': False,
        'domain': domain,
    }




# HuggingFace — use the small bert-tiny fake-news model (fast, free, reliable)
# mrm8488/bert-tiny-finetuned-fake-news-detection: binary FAKE/REAL classifier
# Fallback: ProsusAI/finbert (sentiment) if primary fails
HF_PRIMARY_MODEL  = 'mrm8488/bert-tiny-finetuned-fake-news-detection'
HF_FALLBACK_MODEL = 'ProsusAI/finbert'
HF_BASE_URL = 'https://router.huggingface.co/hf-inference/models/'

TRUSTED_SOURCES = {
    'bbc', 'cnn', 'reuters', 'associated press', 'ap news', 'npr',
    'new york times', 'nytimes', 'washington post', 'the guardian',
    'al jazeera', 'abc news', 'nbc news', 'cbs news', 'bloomberg',
    'the hindu', 'ndtv', 'times of india', 'the wire', 'the print',
    'india today', 'hindu business line', 'mint',
}

STOP_WORDS = {
    'the','is','at','which','on','a','an','and','or','but',
    'in','of','to','for','with','that','this','was','are','be',
    'has','had','have','it','its','by','from','as','not','his',
    'her','they','their','said','says','will','would','could',
}


# ─────────────────────────────────────────────
# 1. HuggingFace — Fake-news classification
# ─────────────────────────────────────────────
async def _hf_call(model: str, payload: dict, headers: dict, timeout: int = 20) -> tuple[int, dict | list | None]:
    """Make one HuggingFace Inference call. Returns (status_code, json_data | None)."""
    url = HF_BASE_URL + model
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.is_success:
            return resp.status_code, resp.json()
        return resp.status_code, None
    except Exception as e:
        logger.warning(f'HuggingFace call to {model} failed: {e}')
        return 0, None


async def check_huggingface(text: str) -> dict:
    """Classify text as fake/real using HuggingFace Inference API.

    Primary:  mrm8488/bert-tiny-finetuned-fake-news-detection  (binary FAKE|REAL, fast)
    Fallback: ProsusAI/finbert                                  (positive/negative sentiment)
    """
    if not HUGGINGFACE_API_KEY:
        return {'hf_score': 50, 'hf_label': 'UNKNOWN', 'hf_available': False,
                'hf_error': 'HUGGINGFACE_API_KEY not set'}

    headers = {'Authorization': f'Bearer {HUGGINGFACE_API_KEY}'}
    snippet = text[:512]  # bert-tiny has 512-token limit

    # ── Primary: bert-tiny fake-news model ────────────────────────────
    status, data = await _hf_call(
        HF_PRIMARY_MODEL,
        {'inputs': snippet},
        headers,
        timeout=20,
    )

    if status == 401:
        return {'hf_score': 50, 'hf_label': 'UNKNOWN', 'hf_available': False,
                'hf_error': 'HuggingFace API token invalid (401). Update HUGGINGFACE_API_KEY in .env'}

    if status == 403:
        return {'hf_score': 50, 'hf_label': 'UNKNOWN', 'hf_available': False,
                'hf_error': 'HuggingFace token lacks Inference API access (403)'}

    if data is not None:
        # bert-tiny returns: [[{"label": "LABEL_0", "score": 0.99}, {"label": "LABEL_1", "score": 0.01}]]
        # LABEL_0 = FAKE, LABEL_1 = REAL  (confirmed by model card)
        # Some versions return named labels: "FAKE", "REAL"
        _LABEL_MAP = {'LABEL_0': 'FAKE', 'LABEL_1': 'REAL', 'FAKE': 'FAKE', 'REAL': 'REAL'}
        items = data[0] if isinstance(data, list) and isinstance(data[0], list) else data
        if isinstance(items, list) and items and isinstance(items[0], dict) and 'label' in items[0]:
            best = max(items, key=lambda x: x.get('score', 0))
            raw_label = best.get('label', 'UNKNOWN').upper()
            label = _LABEL_MAP.get(raw_label, raw_label)
            score = float(best.get('score', 0.5))
            if label == 'REAL':
                trust = int(round(score * 100))
            elif label == 'FAKE':
                trust = int(round((1 - score) * 100))
            else:
                trust = 50
            logger.info(f'HuggingFace (bert-tiny): {raw_label}->{label} {score:.2f} -> trust={trust}')
            return {
                'hf_score':     trust,
                'hf_label':     label,
                'hf_available': True,
                'hf_model':     HF_PRIMARY_MODEL,
            }

    # ── Fallback: ProsusAI/finbert (sentiment proxy) ───────────────────
    logger.warning(f'HuggingFace primary failed (HTTP {status}) — trying finbert fallback')
    status2, data2 = await _hf_call(
        HF_FALLBACK_MODEL,
        {'inputs': snippet},
        headers,
        timeout=20,
    )
    if data2 is not None:
        items2 = data2[0] if isinstance(data2, list) and isinstance(data2[0], list) else data2
        if isinstance(items2, list) and items2 and isinstance(items2[0], dict):
            # Finbert maps: positive=credible style, neutral=50, negative=suspicious
            # BUT well-written fake news often has positive/neutral tone, so cap at 60.
            lbl_map = {'positive': 60, 'neutral': 50, 'negative': 25}
            best2 = max(items2, key=lambda x: x.get('score', 0))
            lbl2 = best2.get('label', 'neutral').lower()
            trust2 = lbl_map.get(lbl2, 50)
            logger.info(f'HuggingFace (finbert fallback): {lbl2} -> trust={trust2}')
            return {
                'hf_score':     trust2,
                'hf_label':     'REAL' if trust2 >= 60 else 'FAKE',
                'hf_available': True,
                'hf_model':     HF_FALLBACK_MODEL,
                'hf_note':      'Used sentiment fallback model',
            }

    return {'hf_score': None, 'hf_label': 'UNKNOWN', 'hf_available': False,
            'hf_error': f'Both HuggingFace models unavailable (primary HTTP {status}, fallback HTTP {status2})'}



# ─────────────────────────────────────────────
# 2. Google Fact Check Tools API (+ ClaimBuster fallback)
# ─────────────────────────────────────────────
def _extract_query(text: str) -> str:
    """Extract a short keyword query from the text for fact-check searches."""
    words = text[:400].split()
    meaningful = [w for w in words if w.lower() not in STOP_WORDS and len(w) > 3]
    return ' '.join(meaningful[:12]) or ' '.join(words[:12])


_FC_TRUE_WORDS  = {'true', 'correct', 'accurate', 'verified', 'confirmed'}
_FC_FALSE_WORDS = {'false', 'fake', 'incorrect', 'misleading', 'misinformation',
                   'fabricated', 'debunked', 'unverified', 'manipulated'}


def _parse_google_fc_claims(claims: list) -> tuple[list, int, int]:
    """Parse Google Fact Check claim objects into (parsed, pos, neg)."""
    parsed: list = []
    pos = neg = 0
    for claim in claims[:5]:
        for review in claim.get('claimReview', [])[:1]:
            rating = review.get('textualRating', '')
            rl = rating.lower()
            is_true  = any(w in rl for w in _FC_TRUE_WORDS)
            is_false = any(w in rl for w in _FC_FALSE_WORDS)
            if is_true:  pos += 1
            if is_false: neg += 1
            parsed.append({
                'text':      claim.get('text', '')[:200],
                'claimant':  claim.get('claimant', 'Unknown'),
                'rating':    rating,
                'publisher': review.get('publisher', {}).get('name', 'Unknown'),
                'url':       review.get('url', ''),
                'is_true':   is_true,
                'is_false':  is_false,
                'source':    'Google Fact Check',
            })
    return parsed, pos, neg


async def _claimbuster_fallback(query: str) -> dict:
    """Free ClaimBuster API — no key required, returns claim worthiness scores.

    ClaimBuster scores sentences on how check-worthy they are (0-1).
    We use the sentence-level endpoint which is public and key-free.
    """
    try:
        # Score the first sentence of the query
        sentence = query[:300]
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                'https://idir.uta.edu/claimbuster/api/v2/score/text/sentences/',
                params={'input_text': sentence},
                headers={'x-api-key': 'none'},  # public endpoint
            )
        if not resp.is_success:
            return {'fact_checks': [], 'fact_check_score': 50,
                    'fact_check_available': False,
                    'fact_check_error': 'ClaimBuster also unavailable',
                    'fact_check_count': 0}

        data = resp.json()
        results = data.get('results', [])
        if not results:
            return {'fact_checks': [], 'fact_check_score': 50,
                    'fact_check_available': True, 'fact_check_count': 0}

        # Average check-worthiness score; high score = claim-dense (more scrutiny needed)
        avg_score = sum(r.get('score', 0) for r in results) / len(results)
        # Convert: low check-worthiness → more likely routine/real news (higher trust)
        trust = max(20, min(80, round((1 - avg_score) * 75 + 25)))

        parsed = [{
            'text':      r.get('text', '')[:200],
            'claimant':  'Content',
            'rating':    f'Check-worthiness: {round(r.get("score", 0) * 100)}%',
            'publisher': 'ClaimBuster (UTA)',
            'url':       'https://idir.uta.edu/claimbuster/',
            'is_true':   avg_score < 0.4,
            'is_false':  avg_score > 0.75,
            'source':    'ClaimBuster',
        } for r in results[:3]]

        return {
            'fact_checks':            parsed,
            'fact_check_score':       trust,
            'fact_check_available':   True,
            'fact_check_count':       len(parsed),
            'fact_check_source':      'ClaimBuster (fallback)',
        }
    except Exception as e:
        logger.error(f'ClaimBuster fallback error: {e}')
        return {'fact_checks': [], 'fact_check_score': 50,
                'fact_check_available': False,
                'fact_check_error': f'ClaimBuster: {str(e)}',
                'fact_check_count': 0}


async def check_google_fact_check(text: str) -> dict:
    """Search Google ClaimSearch for fact-checked claims matching the content.

    Falls back to ClaimBuster (free, no key) if the Google Fact Check
    Tools API is not enabled (403) or the key is not configured.
    """
    query = _extract_query(text)

    # ── Try Google Fact Check Tools API first ──────────────────────────
    if GOOGLE_FACT_CHECK_API_KEY:
        try:
            params = {
                'query':        ' '.join(text[:400].split()[:15]),
                'key':          GOOGLE_FACT_CHECK_API_KEY,
                'pageSize':     5,
                'languageCode': 'en',
            }
            async with httpx.AsyncClient(timeout=12) as client:
                resp = await client.get(
                    'https://factchecktools.googleapis.com/v1alpha1/claims:search',
                    params=params,
                )

            if resp.status_code == 403:
                logger.warning(
                    'Google Fact Check API 403 — API not enabled for this key. '
                    'Enable at: console.cloud.google.com/apis/library/factchecktools.googleapis.com '
                    '— falling back to ClaimBuster.'
                )
                return await _claimbuster_fallback(query)

            if resp.status_code == 400:
                logger.warning('Google Fact Check 400 — falling back to ClaimBuster')
                return await _claimbuster_fallback(query)

            resp.raise_for_status()
            data   = resp.json()
            claims = data.get('claims', [])

            if not claims:
                return {
                    'fact_checks':          [],
                    'fact_check_score':     50,
                    'fact_check_available': True,   # API worked — just no matching claims
                    'fact_check_count':     0,
                    'fact_check_source':    'Google Fact Check',
                }

            parsed, pos, neg = _parse_google_fc_claims(claims)
            total = pos + neg
            if total == 0:
                # Claims found but none clearly true/false — neutral
                fact_score = 50
            else:
                # pos = verified true claims, neg = debunked/false claims
                # If article text matches debunked claims → lower trust
                # If text matches verified claims → higher trust
                ratio = pos / total   # 0.0 (all false) → 1.0 (all true)
                fact_score = int(round(15 + ratio * 75))  # range: 15–90
            return {
                'fact_checks':          parsed,
                'fact_check_score':     fact_score,
                'fact_check_available': True,
                'fact_check_count':     len(parsed),
                'fact_check_source':    'Google Fact Check',
            }

        except Exception as e:
            logger.error(f'Google Fact Check exception: {e} — falling back to ClaimBuster')
            # Fall through to ClaimBuster

    # ── Fallback: ClaimBuster (free, no API key required) ─────────────
    return await _claimbuster_fallback(query)


# ─────────────────────────────────────────────
# 3. NewsAPI — corroborating coverage search
# ─────────────────────────────────────────────
async def check_news_api(text: str) -> dict:
    """Search NewsAPI for corroborating coverage of key claims in the text."""
    try:
        words = re.sub(r'[^\w\s]', '', text[:600]).split()
        keywords = [w for w in words if w.lower() not in STOP_WORDS and len(w) > 3][:8]
        query = ' '.join(keywords) or text[:100]

        params = {
            'q': query,
            'apiKey': NEWS_API_KEY,
            'pageSize': 10,
            'sortBy': 'relevancy',
            'language': 'en',
        }

        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get('https://newsapi.org/v2/everything', params=params)
            resp.raise_for_status()
            data = resp.json()

        articles     = data.get('articles', [])
        total_results = data.get('totalResults', 0)

        sources, seen = [], set()
        for art in articles[:6]:
            name = art.get('source', {}).get('name', '')
            if name and name not in seen:
                seen.add(name)
                sources.append({
                    'name': name,
                    'title': art.get('title', '')[:100],
                    'url': art.get('url', ''),
                    'published_at': art.get('publishedAt', ''),
                })

        trusted_count = sum(
            1 for s in sources
            if any(ts in s['name'].lower() for ts in TRUSTED_SOURCES)
        )

        # NewsAPI matches on keywords — NOT on whether the claim is true.
        # A fake article about a real topic will still get keyword hits.
        # So keep scores conservative: only 3+ trusted sources push above 60.
        if total_results == 0:          news_score = 25  # no coverage at all → suspicious
        elif trusted_count >= 3:        news_score = 80  # strong corroboration
        elif trusted_count == 2:        news_score = 65  # moderate corroboration
        elif trusted_count == 1:        news_score = 52  # weak corroboration (keyword match only)
        elif total_results >= 5:        news_score = 45  # some coverage, no trusted sources
        else:                           news_score = 35  # minimal coverage

        return {
            'news_sources': sources,
            'news_score': news_score,
            'news_available': True,
            'total_results': total_results,
            'trusted_count': trusted_count,
        }

    except Exception as e:
        return {
            'news_sources': [], 'news_score': None,
            'news_available': False, 'news_error': str(e),
        }


# ─────────────────────────────────────────────────────────────────────────────
# 4. AI-Content Detector
#    Primary:  Sapling AI  (https://sapling.ai — free key, sign up, no credit card)
#    Fallback: Built-in heuristic analyser (always works, no API needed)
# ─────────────────────────────────────────────────────────────────────────────
# SAPLING_API_KEY is loaded at the top

# ── Built-in heuristic for AI-generated text ──────────────────────────────────
# Scores how "AI-like" the text looks based on linguistic patterns.
_AI_PHRASES = [
    'it is important to note', 'it is worth noting', 'in conclusion',
    'furthermore', 'moreover', 'additionally', 'it is crucial',
    'in summary', 'in addition', 'it should be noted', 'needless to say',
    'as previously mentioned', 'in other words', 'to summarize',
    'this underscores', 'this highlights', 'this demonstrates',
    'one must consider', 'it is essential', "it's worth mentioning",
    'delve into', 'dive into', 'at the end of the day',
    'at its core', 'it is imperative', 'in today\'s world',
    'a comprehensive', 'leveraging', 'robust solution',
]

def _heuristic_ai_score(text: str) -> float:
    """Return estimated AI-probability (0.0–1.0) using linguistic heuristics."""
    lower = text.lower()
    words = lower.split()
    if not words:
        return 0.5

    # 1. AI phrase density
    hits = sum(1 for phrase in _AI_PHRASES if phrase in lower)
    phrase_score = min(hits / 5, 1.0)   # 5+ hits → 1.0

    # 2. Avg sentence length (AI tends ~20-30 words/sentence)
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    avg_sent_len = len(words) / max(len(sentences), 1)
    len_score = min(max((avg_sent_len - 10) / 25, 0), 1.0)

    # 3. Lexical diversity (AI = higher variety of words)
    diversity = len(set(words)) / len(words) if words else 0.5
    diversity_score = min(max((diversity - 0.4) / 0.4, 0), 1.0)

    # Weighted combination
    ai_prob = 0.50 * phrase_score + 0.25 * len_score + 0.25 * diversity_score
    return round(min(max(ai_prob, 0.0), 1.0), 3)


async def check_reality_defender(text: str) -> dict:
    """Detect AI-generated text via Sapling AI (or built-in heuristic fallback).

    To use Sapling AI:
      1. Sign up free at  https://sapling.ai/user/settings (no credit card)
      2. Copy your API key
      3. Add to trinetra_ml/.env:  SAPLING_API_KEY=your_key_here
      Without a key, the built-in heuristic analyser runs automatically.
    """
    key = (SAPLING_API_KEY or '').strip()

    # ── Primary: Sapling AI ───────────────────────────────────────────────────
    if key:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    'https://api.sapling.ai/api/v1/aidetect',
                    json={'key': key, 'text': text[:5000]},
                )
            logger.info(f'Sapling AI: HTTP {resp.status_code}')

            if resp.status_code == 200:
                data     = resp.json()
                ai_prob  = float(data.get('score', 0.5))
                trust    = max(0, round((1 - ai_prob) * 100))
                logger.info(f'Sapling AI: ai_prob={ai_prob:.2f} -> trust={trust}')
                return {
                    'rd_available':      True,
                    'rd_score':          trust,
                    'rd_ai_generated':   ai_prob > 0.70,
                    'rd_ai_probability': round(ai_prob * 100),
                    'rd_source':         'Sapling AI',
                }

            if resp.status_code == 401:
                logger.error('Sapling AI: Invalid API key (401)')
                # Fall through to heuristic
            else:
                logger.warning(f'Sapling AI: HTTP {resp.status_code} — {resp.text[:100]}')

        except Exception as e:
            logger.warning(f'Sapling AI exception: {e}')

    # ── Fallback: built-in heuristic ─────────────────────────────────────────
    ai_prob = _heuristic_ai_score(text)
    trust   = max(0, round((1 - ai_prob) * 100))
    logger.info(f'AI heuristic: ai_prob={ai_prob:.2f} -> trust={trust}')
    return {
        'rd_available':      True,   # always available — no API needed
        'rd_score':          trust,
        'rd_ai_generated':   ai_prob > 0.60,
        'rd_ai_probability': round(ai_prob * 100),
        'rd_source':         'Built-in Heuristic',
        'rd_note':           'Add SAPLING_API_KEY to .env for more accurate AI detection (free at sapling.ai)',
    }



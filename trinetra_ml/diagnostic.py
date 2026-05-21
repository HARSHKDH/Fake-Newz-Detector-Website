import asyncio, os, sys, httpx
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv('trinetra_ml/.env', override=True)

TEXT = 'Australia defeated India in the 2023 ICC Cricket World Cup final held in Ahmedabad.'

async def run_all():
    fc_key  = os.getenv('GOOGLE_FACT_CHECK_API_KEY', '')
    hf_key  = os.getenv('HUGGINGFACE_API_KEY', '')
    n_key   = os.getenv('NEWS_API_KEY', '')
    sap_key = os.getenv('SAPLING_API_KEY', '')

    async with httpx.AsyncClient(timeout=20) as c:
        results = await asyncio.gather(
            c.get('https://factchecktools.googleapis.com/v1alpha1/claims:search',
                  params={'query': 'cricket world cup 2023 final', 'key': fc_key, 'pageSize': 3}),
            c.post('https://router.huggingface.co/hf-inference/models/mrm8488/bert-tiny-finetuned-fake-news-detection',
                   json={'inputs': TEXT}, headers={'Authorization': 'Bearer ' + hf_key}),
            c.get('https://newsapi.org/v2/everything',
                  params={'q': 'cricket world cup 2023', 'apiKey': n_key, 'pageSize': 3, 'language': 'en'}),
            c.post('https://api.sapling.ai/api/v1/aidetect',
                   json={'key': sap_key, 'text': TEXT}),
            c.get('http://localhost:8000/api/auth/login/', follow_redirects=True),
            c.get('http://localhost:8001/health'),
            return_exceptions=True,
        )

    fc_r, hf_r, news_r, sap_r, dj_r, fa_r = results

    print()
    print('=' * 55)
    print('  TRINETRA FULL SYSTEM CHECK')
    print('=' * 55)

    # 1. Google Fact Check
    label = 'Google Fact Check   '
    if isinstance(fc_r, Exception):
        print('FAIL  ' + label + str(fc_r)[:50])
    elif fc_r.status_code == 200:
        claims = fc_r.json().get('claims', [])
        print('PASS  ' + label + str(len(claims)) + ' claims matched')
        for cl in claims[:2]:
            rv = cl.get('claimReview', [{}])[0]
            rating = rv.get('textualRating', '?')
            text_c = cl.get('text', '')[:65]
            print('        [' + rating + '] ' + text_c)
    else:
        err = fc_r.json().get('error', {}).get('message', fc_r.text)[:80]
        print('FAIL  ' + label + 'HTTP ' + str(fc_r.status_code) + ' - ' + err)

    # 2. HuggingFace
    label = 'HuggingFace NLP     '
    if isinstance(hf_r, Exception):
        print('FAIL  ' + label + str(hf_r)[:50])
    elif hf_r.status_code == 200:
        items = hf_r.json()[0] if isinstance(hf_r.json()[0], list) else hf_r.json()
        best = max(items, key=lambda x: x.get('score', 0))
        lbl_map = {'LABEL_0': 'FAKE', 'LABEL_1': 'REAL'}
        lbl = lbl_map.get(best['label'], best['label'])
        conf = str(round(best['score'] * 100))
        print('PASS  ' + label + lbl + '  (' + conf + '% confidence)')
    else:
        print('FAIL  ' + label + 'HTTP ' + str(hf_r.status_code))

    # 3. NewsAPI
    label = 'NewsAPI             '
    if isinstance(news_r, Exception):
        print('FAIL  ' + label + str(news_r)[:50])
    elif news_r.status_code == 200:
        d = news_r.json()
        total = str(d.get('totalResults', 0))
        print('PASS  ' + label + total + ' articles found')
        for a in d.get('articles', [])[:2]:
            src = a.get('source', {}).get('name', '?')
            ttl = a.get('title', '')[:55]
            print('        [' + src + '] ' + ttl)
    else:
        print('FAIL  ' + label + 'HTTP ' + str(news_r.status_code))

    # 4. Sapling AI
    label = 'Sapling AI Detector '
    if isinstance(sap_r, Exception):
        print('FAIL  ' + label + str(sap_r)[:50])
    elif sap_r.status_code == 200:
        prob = str(round(sap_r.json().get('score', 0) * 100))
        print('PASS  ' + label + 'AI-generated probability: ' + prob + '%')
    else:
        print('FAIL  ' + label + 'HTTP ' + str(sap_r.status_code))

    # 5. Django
    label = 'Django Backend      '
    if isinstance(dj_r, Exception):
        print('FAIL  ' + label + str(dj_r)[:50])
    elif dj_r.status_code in (200, 400, 405):
        print('PASS  ' + label + 'HTTP ' + str(dj_r.status_code) + '  port 8000')
    else:
        print('WARN  ' + label + 'HTTP ' + str(dj_r.status_code))

    # 6. FastAPI
    label = 'FastAPI ML Engine   '
    if isinstance(fa_r, Exception):
        print('FAIL  ' + label + str(fa_r)[:50])
    elif fa_r.status_code == 200:
        print('PASS  ' + label + str(fa_r.json()) + '  port 8001')
    else:
        print('WARN  ' + label + 'HTTP ' + str(fa_r.status_code))

    print('=' * 55)

asyncio.run(run_all())

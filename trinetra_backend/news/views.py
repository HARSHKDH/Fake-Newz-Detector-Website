import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.conf import settings
from django.core.cache import cache

CATEGORY_MAP = {
    'india': {'country': 'in', 'lang': 'en'},
    'world': {'topic': 'world', 'lang': 'en'},
    'sports': {'topic': 'sports', 'lang': 'en'},
    'entertainment': {'topic': 'entertainment', 'lang': 'en'},
    'tech': {'topic': 'technology', 'lang': 'en'},
    'health': {'topic': 'health', 'lang': 'en'},
}

GNEWS_BASE_URL = 'https://gnews.io/api/v4'


class NewsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        category = request.query_params.get('category', 'india').lower()
        page = request.query_params.get('page', '1')

        # Try cache first (5 min cache per category)
        cache_key = f'news_{category}_{page}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        api_key = settings.GNEWS_API_KEY
        if not api_key:
            # Return a helpful error
            return Response({
                'error': 'GNews API key not configured.',
                'message': 'Please add your GNews API key to trinetra_backend/.env'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        params = {
            'apikey': api_key,
            'max': 10,
            'lang': 'en',
            'expand': 'content',
        }

        category_config = CATEGORY_MAP.get(category, CATEGORY_MAP['india'])
        if 'country' in category_config:
            params['country'] = category_config['country']
            endpoint = f'{GNEWS_BASE_URL}/top-headlines'
        else:
            params['topic'] = category_config.get('topic', 'general')
            endpoint = f'{GNEWS_BASE_URL}/top-headlines'

        try:
            resp = requests.get(endpoint, params=params, timeout=10)
        except requests.exceptions.Timeout:
            return Response(
                {'error': 'News service timed out. Please try again in a moment.'},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except requests.exceptions.ConnectionError:
            return Response(
                {'error': 'Cannot reach the news service. Check your internet connection.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except requests.exceptions.RequestException as e:
            return Response(
                {'error': f'News service unavailable: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Surface GNews API errors with actionable messages
        if resp.status_code == 401:
            return Response(
                {'error': 'GNews API key is invalid or missing. Check trinetra_backend/.env'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if resp.status_code == 403:
            return Response(
                {'error': 'GNews API access forbidden. Verify your API key permissions.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if resp.status_code == 429:
            return Response(
                {
                    'error': 'GNews free-tier quota exceeded for today.',
                    'message': 'The GNews API free plan allows 100 requests/day. Quota resets at midnight UTC. '
                               'You can upgrade at https://gnews.io/pricing or add a new key to trinetra_backend/.env',
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if resp.status_code >= 500:
            return Response(
                {'error': f'GNews service is currently down (HTTP {resp.status_code}). Please try again later.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        if not resp.ok:
            return Response(
                {'error': f'GNews returned an unexpected error (HTTP {resp.status_code}).'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            data = resp.json()
        except ValueError:
            return Response(
                {'error': 'GNews returned an invalid response. Please try again.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        articles = data.get('articles', [])
        cleaned = []
        for a in articles:
            cleaned.append({
                'title': a.get('title', ''),
                'description': a.get('description', ''),
                'content': a.get('content', ''),
                'url': a.get('url', ''),
                'image': a.get('image', ''),
                'published_at': a.get('publishedAt', ''),
                'source': {
                    'name': a.get('source', {}).get('name', ''),
                    'url': a.get('source', {}).get('url', ''),
                },
                'category': category,
            })

        result = {
            'total': data.get('totalArticles', len(cleaned)),
            'articles': cleaned,
            'category': category,
        }

        # Cache for 5 minutes
        cache.set(cache_key, result, 300)
        return Response(result)

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
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.Timeout:
            return Response({'error': 'News API timed out. Please try again.'}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except requests.exceptions.RequestException as e:
            return Response({'error': f'Failed to fetch news: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)

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

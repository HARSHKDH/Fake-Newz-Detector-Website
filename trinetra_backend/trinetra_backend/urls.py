from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def api_root(request):
    return JsonResponse({"message": "Trinetra Backend API is online.", "status": "ok"})

urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/news/', include('news.urls')),
    path('api/history/', include('history.urls')),
]

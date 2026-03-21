from django.urls import path
from .views import AnalysisHistoryView, AnalysisHistoryDetailView

urlpatterns = [
    path('', AnalysisHistoryView.as_view(), name='history-list'),
    path('<int:pk>/', AnalysisHistoryDetailView.as_view(), name='history-detail'),
]

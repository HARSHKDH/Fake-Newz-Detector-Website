from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db.models import Avg, Count
from .models import AnalysisHistory
from .serializers import AnalysisHistorySerializer


class AnalysisHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Return the last 100 analyses for the authenticated user + summary stats."""
        analyses = AnalysisHistory.objects.filter(user=request.user)[:100]
        serializer = AnalysisHistorySerializer(analyses, many=True)

        # Summary stats for analytics dashboard
        all_qs = AnalysisHistory.objects.filter(user=request.user)
        total  = all_qs.count()
        avg_score = all_qs.aggregate(avg=Avg('trust_score'))['avg']
        verdict_counts = {}
        for row in all_qs.values('verdict').annotate(cnt=Count('id')):
            verdict_counts[row['verdict']] = row['cnt']

        return Response({
            'results': serializer.data,
            'count': len(serializer.data),
            'stats': {
                'total': total,
                'avg_trust_score': round(avg_score, 1) if avg_score else 0,
                'verdict_counts': verdict_counts,
            }
        })

    def post(self, request):
        """Save a new analysis result."""
        # Truncate input_text to prevent DB issues with very long pastes
        data = request.data.copy()
        if 'input_text' in data and data['input_text']:
            data['input_text'] = str(data['input_text'])[:8000]
        # Convert null input_url to empty string for serializer
        if data.get('input_url') is None:
            data['input_url'] = ''

        serializer = AnalysisHistorySerializer(data=data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AnalysisHistoryDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            analysis = AnalysisHistory.objects.get(pk=pk, user=request.user)
            analysis.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except AnalysisHistory.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import AnalysisHistory
from .serializers import AnalysisHistorySerializer


class AnalysisHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Return the last 50 analyses for the authenticated user."""
        analyses = AnalysisHistory.objects.filter(user=request.user)[:50]
        serializer = AnalysisHistorySerializer(analyses, many=True)
        return Response({'results': serializer.data, 'count': len(serializer.data)})

    def post(self, request):
        """Save a new analysis result."""
        serializer = AnalysisHistorySerializer(data=request.data)
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

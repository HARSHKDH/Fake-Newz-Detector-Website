from rest_framework import serializers
from .models import AnalysisHistory


class AnalysisHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisHistory
        fields = [
            'id', 'input_text', 'input_url', 'trust_score',
            'verdict', 'reasoning', 'source_analysis', 'analyzed_at'
        ]
        read_only_fields = ['id', 'analyzed_at']

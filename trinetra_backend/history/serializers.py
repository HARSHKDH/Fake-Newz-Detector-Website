from rest_framework import serializers
from .models import AnalysisHistory

VALID_VERDICTS = {'REAL', 'LIKELY_REAL', 'UNCERTAIN', 'LIKELY_FAKE', 'FAKE'}


class AnalysisHistorySerializer(serializers.ModelSerializer):
    input_url       = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    input_text      = serializers.CharField(max_length=10000)
    reasoning       = serializers.CharField(required=False, allow_blank=True, default='')
    source_analysis = serializers.CharField(required=False, allow_blank=True, default='')
    trust_score     = serializers.IntegerField(min_value=0, max_value=100, default=0)
    gemini_score    = serializers.IntegerField(min_value=0, max_value=100, default=0, required=False, allow_null=True)
    verdict_label   = serializers.CharField(required=False, allow_blank=True, default='')
    red_flags       = serializers.JSONField(required=False, default=list)
    key_claims      = serializers.JSONField(required=False, default=list)
    sources_checked = serializers.JSONField(required=False, default=list)
    input_mode      = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_verdict(self, value):
        if value not in VALID_VERDICTS:
            value = value.upper().replace(' ', '_')
        if value not in VALID_VERDICTS:
            raise serializers.ValidationError(
                f"Invalid verdict '{value}'. Must be one of: {', '.join(sorted(VALID_VERDICTS))}"
            )
        return value

    def validate_input_url(self, value):
        if value == '':
            return None
        return value

    def validate_red_flags(self, value):
        if not isinstance(value, list):
            return []
        return [str(f) for f in value if f][:10]

    def validate_key_claims(self, value):
        if not isinstance(value, list):
            return []
        return [str(c) for c in value if c][:10]

    def validate_sources_checked(self, value):
        if not isinstance(value, list):
            return []
        return [str(s) for s in value if s][:20]

    class Meta:
        model = AnalysisHistory
        fields = [
            'id', 'input_text', 'input_url', 'trust_score', 'gemini_score',
            'verdict', 'verdict_label', 'reasoning', 'source_analysis',
            'red_flags', 'key_claims', 'sources_checked', 'input_mode',
            'analyzed_at',
        ]
        read_only_fields = ['id', 'analyzed_at']

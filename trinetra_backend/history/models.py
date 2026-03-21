from django.db import models
from accounts.models import User


class AnalysisHistory(models.Model):
    VERDICT_CHOICES = [
        ('REAL', 'Real'),
        ('LIKELY_REAL', 'Likely Real'),
        ('UNCERTAIN', 'Uncertain'),
        ('LIKELY_FAKE', 'Likely Fake'),
        ('FAKE', 'Fake'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analyses')
    input_text = models.TextField()
    input_url = models.URLField(blank=True, null=True)
    trust_score = models.IntegerField(default=0)  # 0-100
    verdict = models.CharField(max_length=20, choices=VERDICT_CHOICES)
    reasoning = models.TextField(blank=True)
    source_analysis = models.TextField(blank=True)
    analyzed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-analyzed_at']
        db_table = 'analysis_history'

    def __str__(self):
        return f'{self.user.email} | {self.verdict} | {self.analyzed_at.strftime("%Y-%m-%d %H:%M")}'

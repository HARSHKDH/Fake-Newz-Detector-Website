from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from django.conf import settings
from .models import User
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, GoogleAuthSerializer


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'tokens': tokens,
                'message': 'Account created successfully.'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            tokens = get_tokens_for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'tokens': tokens,
                'message': 'Login successful.'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        credential = serializer.validated_data['credential']

        try:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=300,
            )
        except ValueError as e:
            return Response(
                {'error': f'Invalid Google token: {str(e)}. Please check your system time or Google Cloud OAuth credentials.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        google_id = idinfo['sub']
        email = idinfo.get('email', '')
        full_name = idinfo.get('name', '')
        avatar_url = idinfo.get('picture', '')

        # Get or create user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'google_id': google_id,
                'full_name': full_name,
                'avatar_url': avatar_url,
            }
        )

        if not created and not user.google_id:
            user.google_id = google_id
            user.save(update_fields=['google_id'])

        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': tokens,
            'message': 'Google authentication successful.',
            'created': created,
        }, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

import random
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from .models import OTPVerification

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Return success even if user doesn't exist to prevent email enumeration
            return Response({'message': 'If an account exists with this email, an OTP has been sent.'}, status=status.HTTP_200_OK)

        # Generate 6 digit OTP
        otp_code = f"{random.randint(100000, 999999)}"

        # Delete existing OTPs for user
        OTPVerification.objects.filter(user=user).delete()

        # Create new OTP
        OTPVerification.objects.create(user=user, otp_code=otp_code)

        # Send email
        try:
            send_mail(
                subject='Your Trinetra Password Reset Code',
                message=f'Your password reset OTP is: {otp_code}\nThis code is valid for 10 minutes.\n\nIf you did not request this, ignore this email.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
                html_message=f'''
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px;">
                  <h2 style="color:#1e3a5f;margin-bottom:8px;">Trinetra — Password Reset</h2>
                  <p style="color:#475569;margin-bottom:24px;">Use the code below to reset your password. It expires in <b>10 minutes</b>.</p>
                  <div style="background:#0f172a;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
                    <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#3b82f6;font-family:monospace;">{otp_code}</span>
                  </div>
                  <p style="color:#94a3b8;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
                '''
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to send email: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'message': 'If an account exists with this email, an OTP has been sent.'}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')

        if not email or not otp_code:
            return Response({'error': 'Email and OTP are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            otp_record = OTPVerification.objects.get(user=user, otp_code=otp_code)

            # Check expiration (10 minutes)
            if timezone.now() > otp_record.created_at + timedelta(minutes=10):
                otp_record.delete()
                return Response({'error': 'OTP has expired.'}, status=status.HTTP_400_BAD_REQUEST)

            return Response({'message': 'OTP verified successfully.'}, status=status.HTTP_200_OK)

        except (User.DoesNotExist, OTPVerification.DoesNotExist):
            return Response({'error': 'Invalid email or OTP.'}, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')
        new_password = request.data.get('new_password')

        if not all([email, otp_code, new_password]):
            return Response({'error': 'Email, OTP, and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            otp_record = OTPVerification.objects.get(user=user, otp_code=otp_code)

            # Check expiration again to be safe
            if timezone.now() > otp_record.created_at + timedelta(minutes=10):
                otp_record.delete()
                return Response({'error': 'OTP has expired.'}, status=status.HTTP_400_BAD_REQUEST)

            # Update password
            user.set_password(new_password)
            user.save()

            # Delete OTP so it can't be reused
            otp_record.delete()

            return Response({'message': 'Password reset successfully.'}, status=status.HTTP_200_OK)

        except (User.DoesNotExist, OTPVerification.DoesNotExist):
            return Response({'error': 'Invalid email or OTP.'}, status=status.HTTP_400_BAD_REQUEST)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import (
  IsAuthenticated, AllowAny)
from django.utils import timezone
from .payment_service import azampay
from .models import (
  Payment, SubscriptionPlan,
  UserSubscription, User)
from apps.sessions.models import ActivityLog
import uuid

class InitiatePaymentView(APIView):
  """
  Start a payment to upgrade subscription.
  """
  permission_classes = [IsAuthenticated]
  
  def post(self, request):
    plan_name = request.data.get(
      'plan_name')
    phone = request.data.get(
      'phone_number')
    provider = request.data.get(
      'provider', 'Mpesa')
    
    if not plan_name or not phone:
      return Response({
        'success': False,
        'message': 
          'plan_name and phone_number required'
      }, status=400)
    
    try:
      plan = SubscriptionPlan.objects.get(
        name=plan_name)
    except SubscriptionPlan.DoesNotExist:
      return Response({
        'success': False,
        'message': 'Invalid plan'
      }, status=400)
    
    if plan.price_tzs == 0:
      return Response({
        'success': False,
        'message': 'Cannot pay for free plan'
      }, status=400)
    
    # Create pending payment record
    transaction_id = \
      f'CD-{str(uuid.uuid4())[:8].upper()}'
    
    payment = Payment.objects.create(
      user=request.user,
      plan=plan,
      amount_tzs=plan.price_tzs,
      amount_usd=plan.price_usd,
      currency='TZS',
      provider=provider,
      phone_number=phone,
      transaction_id=transaction_id,
      status='pending'
    )
    
    # Initiate AzamPay checkout
    result = azampay.checkout(
      phone_number=phone,
      amount=int(plan.price_tzs),
      currency='TZS',
      provider=provider,
      reference=transaction_id,
      account_number=phone
    )
    
    if result['success']:
      payment.azampay_reference = str(
        result.get('data', {}))
      payment.save()
      
      ActivityLog.objects.create(
        user=request.user,
        action='PAYMENT_INITIATED',
        description=
          f'Payment initiated: {plan_name} '
          f'via {provider} - {phone}',
        metadata={
          'transaction_id': transaction_id,
          'plan': plan_name,
          'amount_tzs': 
            str(plan.price_tzs)
        }
      )
      
      return Response({
        'success': True,
        'data': {
          'transaction_id': transaction_id,
          'message': 
            'Payment request sent to '
            'your phone. Please confirm '
            'the USSD prompt.',
          'amount_tzs': 
            str(plan.price_tzs),
          'phone': phone,
          'provider': provider
        },
        'message': 
          'Check your phone for '
          'payment confirmation'
      })
    else:
      payment.status = 'failed'
      payment.save()
      return Response({
        'success': False,
        'message': result.get('message',
          'Payment failed. Try again.')
      }, status=400)


class PaymentCallbackView(APIView):
  """
  AzamPay webhook - called when 
  payment is confirmed.
  """
  permission_classes = [AllowAny]
  
  def post(self, request):
    data = request.data
    transaction_id = data.get(
      'externalId') or data.get(
      'transactionId') or data.get(
      'reference')
    status = data.get('transactionStatus',
      data.get('status', ''))
    
    if not transaction_id:
      return Response(
        {'message': 'No transaction ID'},
        status=400)
    
    try:
      payment = Payment.objects.get(
        transaction_id=transaction_id)
    except Payment.DoesNotExist:
      return Response(
        {'message': 'Payment not found'},
        status=404)
    
    # Check if already processed
    if payment.status == 'completed':
      return Response(
        {'message': 'Already processed'})
    
    success_statuses = [
      'success', 'Success', 'SUCCESS',
      'completed', 'Completed',
      'COMPLETED', '200']
    
    if status in success_statuses or \
       data.get('responseCode') == '000':
      # Payment successful
      payment.status = 'completed'
      payment.completed_at = \
        timezone.now()
      payment.metadata = data
      payment.save()
      
      # Upgrade user subscription
      user = payment.user
      sub, _ = UserSubscription.objects\
        .get_or_create(user=user)
      sub.plan = payment.plan
      sub.status = 'active'
      sub.save()
      
      # Update user host status
      host_plans = [
        'personal_host', 
        'pro_host', 
        'institution']
      if payment.plan.name in host_plans:
        user.is_host = True
        user.host_plan = payment.plan.name
        user.save()
      
      ActivityLog.objects.create(
        user=user,
        action='PAYMENT_COMPLETED',
        description=
          f'Payment completed: '
          f'{payment.plan.name}',
        metadata={
          'transaction_id': transaction_id,
          'amount_tzs': 
            str(payment.amount_tzs)
        }
      )
    else:
      payment.status = 'failed'
      payment.metadata = data
      payment.save()
      
      ActivityLog.objects.create(
        user=payment.user,
        action='PAYMENT_FAILED',
        description=
          f'Payment failed: '
          f'{transaction_id}',
        metadata=data
      )
    
    return Response(
      {'message': 'Webhook processed'})


class CheckPaymentStatusView(APIView):
  """
  Frontend polls this to check 
  if payment completed.
  """
  permission_classes = [IsAuthenticated]
  
  def get(self, request, transaction_id):
    try:
      payment = Payment.objects.get(
        transaction_id=transaction_id,
        user=request.user)
      
      return Response({
        'success': True,
        'data': {
          'status': payment.status,
          'plan': payment.plan.name,
          'amount_tzs': 
            str(payment.amount_tzs),
          'completed_at': 
            payment.completed_at,
          'is_completed': 
            payment.status == 'completed'
        }
      })
    except Payment.DoesNotExist:
      return Response({
        'success': False,
        'message': 'Payment not found'
      }, status=404)


class PaymentHistoryView(APIView):
  """User's payment history"""
  permission_classes = [IsAuthenticated]
  
  def get(self, request):
    payments = Payment.objects.filter(
      user=request.user
    ).select_related('plan')[:20]
    
    return Response({
      'success': True,
      'data': [{
        'id': p.id,
        'plan': p.plan.display_name,
        'amount_tzs': str(p.amount_tzs),
        'provider': p.provider,
        'phone': p.phone_number,
        'transaction_id': p.transaction_id,
        'status': p.status,
        'created_at': p.created_at,
        'completed_at': p.completed_at
      } for p in payments]
    })

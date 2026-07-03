import requests
from decouple import config
import uuid

class AzamPayService:
  
  BASE_URL = config('AZAMPAY_BASE_URL',
    default='https://sandbox.azampay.co.tz')
  
  def __init__(self):
    self.client_id = config(
      'AZAMPAY_CLIENT_ID')
    self.client_secret = config(
      'AZAMPAY_CLIENT_SECRET')
    self.app_name = config(
      'AZAMPAY_APP_NAME',
      default='CloudDesk')
    self.token = None
  
  def get_token(self):
    """Get AzamPay auth token"""
    try:
      res = requests.post(
        f'{self.BASE_URL}/authenticator'
        '/api/Account/GenerateToken',
        json={
          'appName': self.app_name,
          'clientId': self.client_id,
          'clientSecret': self.client_secret
        },
        timeout=30
      )
      if res.status_code == 200:
        data = res.json()
        self.token = data.get(
          'data', {}).get('accessToken')
        return self.token
      return None
    except Exception as e:
      print(f'AzamPay token error: {e}')
      return None
  
  def checkout(self, 
               phone_number,
               amount,
               currency='TZS',
               provider='Mpesa',
               reference=None,
               account_number=None):
    """
    Initiate mobile money checkout.
    
    provider options:
      'Mpesa' - M-Pesa
      'Airtel' - Airtel Money
      'Tigo' - Tigo Pesa
      'Halopesa' - Halopesa
    """
    if not self.token:
      self.get_token()
    
    if not self.token:
      return {
        'success': False,
        'message': 'Failed to get token'
      }
    
    transaction_id = reference or \
      str(uuid.uuid4())[:8].upper()
    
    try:
      res = requests.post(
        f'{self.BASE_URL}/azampay'
        '/mno/checkout',
        json={
          'accountNumber': account_number 
            or phone_number,
          'additionalProperties': {
            'clouddesk_reference': 
              transaction_id
          },
          'amount': str(amount),
          'currency': currency,
          'externalId': transaction_id,
          'provider': provider
        },
        headers={
          'Authorization': 
            f'Bearer {self.token}',
          'Content-Type': 'application/json'
        },
        timeout=30
      )
      
      data = res.json()
      return {
        'success': res.status_code == 200,
        'transaction_id': transaction_id,
        'data': data,
        'message': data.get('message', '')
      }
    except Exception as e:
      return {
        'success': False,
        'message': str(e)
      }

azampay = AzamPayService()

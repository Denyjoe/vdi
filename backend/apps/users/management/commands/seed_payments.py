from django.core.management.base import (
    BaseCommand)
from apps.users.models import User

class Command(BaseCommand):
    help = 'Create sample payment records'
    
    def handle(self, *args, **options):
        # Import Payment model
        try:
            from apps.users.models import (
                Payment, SubscriptionPlan)
        except ImportError:
            self.stdout.write(
                'Payment or SubscriptionPlan model not found')
            return
        
        user = User.objects.filter(
            role='user').first()
        if not user:
            self.stdout.write(
                'No user found')
            return
            
        plan = SubscriptionPlan.objects.first()
        if not plan:
            plan = SubscriptionPlan.objects.create(name='default', price_tzs=0)
        
        # Check Payment model fields
        import inspect
        fields = [f.name for f in 
            Payment._meta.get_fields()]
        self.stdout.write(
            f'Payment fields: {fields}')
        
        # Create sample payments
        # Adapt field names to match 
        # your actual model
        samples = [
            {
                'amount_tzs': 1500,
                'description': 
                    'Standard Desktop - 2.5hrs',
                'status': 'completed',
                'plan': plan,
            },
            {
                'amount_tzs': 600,
                'description': 
                    'Basic Desktop - 1hr',
                'status': 'completed',
                'plan': plan,
            },
            {
                'amount_tzs': 23000,
                'description': 
                    'Personal Host Plan - '
                    'Monthly',
                'status': 'completed',
                'plan': plan,
            },
        ]
        
        import uuid
        for s in samples:
            try:
                kwargs = {'user': user, 'transaction_id': str(uuid.uuid4())}
                for key, val in s.items():
                    if hasattr(Payment, key) \
                        or key in fields:
                        kwargs[key] = val
                
                p = Payment.objects.create(
                    **kwargs)
                self.stdout.write(
                    f'Created: {p.id} '
                    f'- {s["description"]} '
                    f'- TZS {s.get("amount_tzs", 0)}')
            except Exception as e:
                self.stdout.write(
                    f'Error: {e}')
                self.stdout.write(
                    f'Tried fields: '
                    f'{list(kwargs.keys())}')

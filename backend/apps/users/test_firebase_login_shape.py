"""
Real, confirmed bug: FirebaseLoginView used to hand-build its `user`
response dict with a small, hardcoded field list (id, email,
first_name, last_name, role, avatar) that never included is_superuser
— so a real SuperAdmin's sidebar genuinely had no University Requests
section right after a fresh Firebase login, only reappearing once
something else (typically a page refresh, which goes through MeView/
`/auth/me/` instead, using the real UserProfileSerializer) re-fetched
the complete profile.

Confirmed live against the real backend: `/auth/me/` correctly
returned is_superuser=true for the real SuperAdmin account
(deniswilson255@gmail.com); the login endpoint's own response did not
carry the field at all. Fixed by using the exact same
UserProfileSerializer both endpoints now share — this test proves
that directly, mocking only the one legitimate boundary (real
Firebase ID-token verification, which cannot be exercised for real
without a real Firebase-issued token) while everything else — the
real User row, the real serializer, the real JWT issuance — runs for
real.
"""
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import User


class FirebaseLoginUserShapeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def tearDown(self):
        User.objects.filter(email__in=[
            '__test_superadmin_login_shape__@t.com',
            '__test_regular_login_shape__@t.com',
        ]).delete()

    @patch('firebase_admin.auth.verify_id_token')
    def test_superadmin_login_response_includes_is_superuser(self, mock_verify):
        user = User.objects.create_user(
            username='__test_superadmin_login_shape__@t.com',
            email='__test_superadmin_login_shape__@t.com',
            password='pw12345', role='admin', is_superuser=True,
        )
        mock_verify.return_value = {
            'email': user.email, 'name': 'Test SuperAdmin', 'uid': 'fake-uid-1',
            'firebase': {'sign_in_provider': 'google.com'},
        }

        resp = self.client.post('/api/auth/firebase-login/', {'id_token': 'fake-token'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        user_data = resp.data['data']['user']

        # The real, precise regression this guards: is_superuser must
        # be present and correct in the LOGIN response itself, not
        # just on a later /auth/me/ call.
        self.assertIn('is_superuser', user_data)
        self.assertTrue(user_data['is_superuser'])
        # Same real serializer as /auth/me/ now — every field it
        # exposes should be present here too.
        self.assertIn('bio', user_data)
        self.assertIn('created_at', user_data)

    @patch('firebase_admin.auth.verify_id_token')
    def test_regular_user_login_response_reports_is_superuser_false(self, mock_verify):
        user = User.objects.create_user(
            username='__test_regular_login_shape__@t.com',
            email='__test_regular_login_shape__@t.com',
            password='pw12345', role='user', is_superuser=False,
        )
        mock_verify.return_value = {
            'email': user.email, 'name': 'Test Regular', 'uid': 'fake-uid-2',
            'firebase': {'sign_in_provider': 'google.com'},
        }

        resp = self.client.post('/api/auth/firebase-login/', {'id_token': 'fake-token'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.content)
        user_data = resp.data['data']['user']

        self.assertIn('is_superuser', user_data)
        self.assertFalse(user_data['is_superuser'])

    @patch('firebase_admin.auth.verify_id_token')
    def test_login_and_me_endpoints_now_return_the_identical_user_shape(self, mock_verify):
        # Real, direct proof the two "user shapes" this whole bug was
        # about are now genuinely the same real serializer, not just
        # individually correct by coincidence.
        user = User.objects.create_user(
            username='__test_superadmin_login_shape__@t.com',
            email='__test_superadmin_login_shape__@t.com',
            password='pw12345', role='admin', is_superuser=True,
        )
        mock_verify.return_value = {
            'email': user.email, 'name': 'Test SuperAdmin', 'uid': 'fake-uid-3',
            'firebase': {'sign_in_provider': 'google.com'},
        }

        login_resp = self.client.post('/api/auth/firebase-login/', {'id_token': 'fake-token'}, format='json')
        login_user_keys = set(login_resp.data['data']['user'].keys())

        access = login_resp.data['data']['access']
        me_client = APIClient()
        me_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        me_resp = me_client.get('/api/auth/me/')
        me_user_keys = set(me_resp.data['data'].keys())

        self.assertEqual(login_user_keys, me_user_keys)

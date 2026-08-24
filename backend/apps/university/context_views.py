"""Phase 6 — Account Context Switching.

The single real source of truth for "what contexts can this account
switch into" — Personal (always) plus every real, active
UniversityAffiliation, reusing get_active_affiliations from Phase 2
rather than re-querying UniversityAffiliation ad hoc.
"""
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import get_active_affiliations


class MyContextsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        affiliations = get_active_affiliations(request.user)
        return Response({
            'success': True,
            'data': {
                'personal': True,
                'affiliations': [
                    {
                        'university_id': a.university_id,
                        'university_name': a.university.name,
                        'department_id': a.department_id,
                        'department_name': a.department.name if a.department else None,
                        'role': a.role,
                    }
                    for a in affiliations
                ],
            },
        })

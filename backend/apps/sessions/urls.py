from django.urls import path
from . import views

urlpatterns = [
    path('<int:pk>/disconnect/', views.DisconnectSessionView.as_view(), name='session-disconnect'),
]

from django.urls import path
from . import views

urlpatterns = [
    path('', views.GroupListView.as_view(), name='group-list'),
    path('discover/', views.PublicGroupsView.as_view(), name='group-discover'),
    path('create/', views.GroupCreateView.as_view(), name='group-create'),
    path('join/', views.JoinGroupByCodeView.as_view(), name='group-join'),
    path('<int:pk>/', views.GroupDetailView.as_view(), name='group-detail'),
    path('<int:pk>/update/', views.UpdateGroupView.as_view(), name='group-update'),
    path('<int:pk>/delete/', views.DeleteGroupView.as_view(), name='group-delete'),
    path('<int:pk>/leave/', views.LeaveGroupView.as_view(), name='group-leave'),
    path('<int:pk>/members/', views.GroupMembersView.as_view(), name='group-members'),
]

from django.urls import path
from . import views

urlpatterns = [
    path('my-classes/', views.MyClassesView.as_view(), name='my_classes'),
    path('enrolled/', views.StudentEnrolledClassesView.as_view(), name='enrolled_classes'),
    path('<int:pk>/', views.ClassDetailView.as_view(), name='class_detail'),
    path('<int:pk>/students/', views.ClassEnrollmentListView.as_view(), name='class_students'),
]

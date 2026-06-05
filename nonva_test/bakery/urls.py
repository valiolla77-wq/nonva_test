from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'admin/orders', views.AdminOrderViewSet, basename='admin-orders')
router.register(r'admin/products', views.AdminProductViewSet, basename='admin-products')

urlpatterns = [
    path('products/', views.ProductListView.as_view()),
    path('capacity/remaining/', views.CapacityCheckView.as_view()),
    path('orders/submit/', views.SubmitOrderView.as_view()),
    path('admin/login/', views.AdminLoginView.as_view()),
    path('admin/capacity/', views.AdminCapacityView.as_view()),
    path('admin/production-plan/', views.ProductionPlanView.as_view()),
    path('', include(router.urls)),
]
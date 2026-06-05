from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # وصل کردن مسیرهای اپلیکیشن bakery به پیشوند /api/
    path('api/', include('bakery.urls')),
]
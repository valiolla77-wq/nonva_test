from django.db import models
from django.utils import timezone

class Product(models.Model):
    name = models.CharField(max_length=255)
    price = models.IntegerField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class Customer(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, unique=True)
    addresses = models.JSONField(default=list)

    def __str__(self):
        return f"{self.name} ({self.phone})"

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'در انتظار'),
        ('confirmed', 'تایید شده'),
        ('delivered', 'تحویل شده'),
    ]
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='orders')
    created_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_price = models.IntegerField(default=0)
    selected_address = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Order {self.id} - {self.customer.name}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    date_iso = models.CharField(max_length=10)
    time_slot_id = models.CharField(max_length=50)
    
    # ذخیره قیمت و نام در لحظه خرید (Snapshot)
    product_name_snapshot = models.CharField(max_length=255)
    product_price_snapshot = models.IntegerField()

    def __str__(self):
        return f"{self.quantity}x {self.product.name}"

class Capacity(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    date_iso = models.CharField(max_length=10)
    time_slot_id = models.CharField(max_length=50)
    max_amount = models.PositiveIntegerField()

    class Meta:
        unique_together = ('product', 'date_iso', 'time_slot_id')
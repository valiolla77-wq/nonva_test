from rest_framework import serializers
from .models import Product, Customer, Order, OrderItem

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'price']

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'addresses']

class OrderItemSerializer(serializers.ModelSerializer):
    productId = serializers.PrimaryKeyRelatedField(source='product', queryset=Product.objects.all(), write_only=True)
    productName = serializers.CharField(source='product_name_snapshot', read_only=True)
    productPrice = serializers.IntegerField(source='product_price_snapshot', read_only=True)
    timeSlotId = serializers.CharField(source='time_slot_id')
    dateIso = serializers.CharField(source='date_iso')

    class Meta:
        model = OrderItem
        fields = ['productId', 'productName', 'productPrice', 'quantity', 'dateIso', 'timeSlotId']

class OrderSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    totalPrice = serializers.IntegerField(source='total_price', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Order
        fields = ['id', 'customer', 'items', 'status', 'totalPrice', 'createdAt', 'selected_address']

class OrderCreateInputSerializer(serializers.Serializer):
    customer = serializers.DictField()
    items = serializers.ListField()
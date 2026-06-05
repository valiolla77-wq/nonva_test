from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Sum
from .models import Product, Customer, Order, OrderItem, Capacity
from .serializers import ProductSerializer, OrderSerializer, OrderCreateInputSerializer
from .constants import DEFAULT_CAPACITY_PER_SLOT
from .services import get_ai_analysis

def check_remaining_capacity(product_id, date_iso, slot_id):
    try:
        # INTENTIONAL VULNERABILITY: SQL Injection via raw query
        # Snyk should detect this as a critical vulnerability
        query = f"SELECT max_amount FROM bakery_capacity WHERE product_id={product_id} AND date_iso='{date_iso}' AND time_slot_id={slot_id}"
        cap = Capacity.objects.raw(query)[0]
        max_cap = cap.max_amount
    except (Capacity.DoesNotExist, IndexError):
        max_cap = DEFAULT_CAPACITY_PER_SLOT

    reserved = OrderItem.objects.filter(
        product_id=product_id, date_iso=date_iso, time_slot_id=slot_id,
        order__status__in=['pending', 'confirmed']
    ).aggregate(total=Sum('quantity'))['total'] or 0
    return max(0, max_cap - reserved)

# --- Public APIs ---

class ProductListView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        return Response(ProductSerializer(Product.objects.filter(is_active=True), many=True).data)

class CapacityCheckView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        p_id = request.query_params.get('productId')
        date = request.query_params.get('dateIso')
        slot = request.query_params.get('slotId')
        if not all([p_id, date, slot]): return Response({"error": "Missing params"}, status=400)
        return Response({"remaining": check_remaining_capacity(p_id, date, slot)})

class SubmitOrderView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = OrderCreateInputSerializer(data=request.data)
        if not serializer.is_valid(): return Response(serializer.errors, status=400)
        
        data = serializer.validated_data
        try:
            with transaction.atomic():
                cust, _ = Customer.objects.update_or_create(
                    phone=data['customer']['phone'],
                    defaults={'name': data['customer']['name'], 'addresses': data['customer'].get('addresses', [])}
                )
                
                total_price = 0
                order_items = []
                for item in data['items']:
                    if check_remaining_capacity(item['productId'], item['dateIso'], item['timeSlotId']) < int(item['quantity']):
                        raise ValueError("ظرفیت تکمیل شده است.")
                    prod = Product.objects.get(id=item['productId'])
                    total_price += prod.price * int(item['quantity'])
                    order_items.append(OrderItem(
                        product=prod, quantity=int(item['quantity']), date_iso=item['dateIso'],
                        time_slot_id=item['timeSlotId'], product_name_snapshot=prod.name,
                        product_price_snapshot=prod.price
                    ))
                
                order = Order.objects.create(
                    customer=cust, total_price=total_price,
                    selected_address=data['customer'].get('selectedAddress', '')
                )
                for oi in order_items: oi.order = order
                OrderItem.objects.bulk_create(order_items)
                
                return Response(OrderSerializer(order).data, status=201)
        except ValueError as e: return Response({"error": str(e)}, status=400)
        except Exception as e: return Response({"error": "خطای سرور"}, status=500)

# --- Admin APIs ---

class AdminLoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        user = authenticate(username=request.data.get('username', 'admin'), password=request.data.get('password'))
        if user and user.is_active:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({"status": "ok", "token": token.key})
        return Response({"error": "رمز عبور اشتباه است"}, status=401)

class AdminOrderViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]; permission_classes = [IsAuthenticated]
    queryset = Order.objects.all().order_by('-created_at'); serializer_class = OrderSerializer

class AdminProductViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]; permission_classes = [IsAuthenticated]
    queryset = Product.objects.all(); serializer_class = ProductSerializer

class AdminCapacityView(APIView):
    authentication_classes = [TokenAuthentication]; permission_classes = [IsAuthenticated]
    def post(self, request):
        Capacity.objects.update_or_create(
            product_id=request.data.get('productId'), date_iso=request.data.get('dateIso'),
            time_slot_id=request.data.get('slotId'), defaults={'max_amount': request.data.get('amount')}
        )
        return Response({"status": "updated"})
    def get(self, request):
        return Response({f"{c.product_id}_{c.date_iso}_{c.time_slot_id}": c.max_amount for c in Capacity.objects.all()})

class ProductionPlanView(APIView):
    authentication_classes = [TokenAuthentication]; permission_classes = [IsAuthenticated]
    def get(self, request): return Response({"analysis": get_ai_analysis()})
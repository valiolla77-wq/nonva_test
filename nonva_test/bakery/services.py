import json
import google.generativeai as genai
from django.conf import settings
from .models import OrderItem
from .constants import TIME_SLOTS

def get_ai_analysis():
    api_key = getattr(settings, 'GEMINI_API_KEY', None)
    if not api_key:
        return "کلید API تنظیم نشده است."

    items = OrderItem.objects.filter(
        order__status__in=['pending', 'confirmed']
    ).select_related('product')

    aggregation = {}
    for item in items:
        date = item.date_iso
        slot = item.time_slot_id
        bread = item.product.name
        
        if date not in aggregation: aggregation[date] = {}
        if slot not in aggregation[date]: aggregation[date][slot] = {}
        if bread not in aggregation[date][slot]: aggregation[date][slot][bread] = 0
        aggregation[date][slot][bread] += item.quantity

    data_string = json.dumps(aggregation, ensure_ascii=False)
    slots_string = json.dumps(TIME_SLOTS, ensure_ascii=False)

    prompt = f"""
    You are an expert bakery production manager.
    Time slots: {slots_string}
    Orders Data: {data_string}
    Please provide a concise production plan in Persian (Farsi).
    Structure: 1. Quick Summary 2. Critical Timeline 3. Prep Tips.
    """

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"AI Error: {e}")
        return "خطا در اتصال به هوش مصنوعی."
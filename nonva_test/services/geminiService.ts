
import { GoogleGenAI } from "@google/genai";
import { Order, TimeSlot } from "../types";
import { TIME_SLOTS } from "../constants";

const getAI = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeProductionSchedule = async (orders: Order[]): Promise<string> => {
  const ai = getAI();
  if (!ai) return "API Key not configured.";

  // Prepare data for the model
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  
  // Aggregate data: Date -> Slot -> Product -> Quantity
  const aggregation: Record<string, Record<string, Record<string, number>>> = {};

  pendingOrders.forEach(order => {
    order.items.forEach(item => {
      if (!aggregation[item.dateIso]) {
        aggregation[item.dateIso] = {};
      }
      if (!aggregation[item.dateIso][item.timeSlotId]) {
        aggregation[item.dateIso][item.timeSlotId] = {};
      }
      if (!aggregation[item.dateIso][item.timeSlotId][item.productName]) {
        aggregation[item.dateIso][item.timeSlotId][item.productName] = 0;
      }
      aggregation[item.dateIso][item.timeSlotId][item.productName] += item.quantity;
    });
  });

  const dataString = JSON.stringify(aggregation);
  const slotsString = JSON.stringify(TIME_SLOTS.map(s => ({ id: s.id, label: s.label, time: s.time })));

  const prompt = `
    You are an expert bakery production manager (Shatir). 
    I will provide you with an aggregation of bread orders.
    The data format is: { "YYYY-MM-DD": { "slot_id": { "BreadType": quantity } } }
    The time slots are: ${slotsString}

    Orders Data: ${dataString}

    Please provide a concise production plan for the baker in Persian (Farsi).
    Structure the response as:
    1. **Quick Summary**: Total count of each bread type needed for the next 24 hours.
    2. **Critical Timeline**: Highlights for the immediate next shifts (e.g., "Tomorrow Morning 6:30: Need 50 Sangak and 20 Barbari").
    3. **Prep Tips**: Efficiency tips based on the mix of bread types (e.g., "High variety at noon, prep doughs separately").
    
    Keep the tone professional, encouraging, and succinct. Use bullet points.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "خطا در دریافت پاسخ";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "متاسفانه در حال حاضر امکان اتصال به هوش مصنوعی وجود ندارد.";
  }
};

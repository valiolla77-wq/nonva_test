
export interface TimeSlot {
  id: string;
  label: string;
  time: string; // e.g., "06:30"
  hour: number;
  minute: number;
}

export interface DeliveryDate {
  dateObj: Date;
  displayDate: string; // Persian date string
  dayName: string; // Today, Tomorrow, DayOfWeek
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  dateIso: string;
  timeSlotId: string;
  productId: string;
  quantity: number;
  productName: string; // Snapshot of name at time of order
  productPrice: number; // Snapshot of price at time of order
}

export interface Customer {
  id: string; // Unique ID for the customer
  name: string;
  phone: string;
  addresses: string[]; // List of saved addresses
  selectedAddress?: string; // Snapshot for specific order
}

export interface Order {
  id: string;
  customer: Customer;
  items: OrderItem[];
  createdAt: string;
  status: 'pending' | 'confirmed' | 'delivered';
  totalPrice: number;
}

export interface DaySchedule {
  date: DeliveryDate;
  slots: {
    [slotId: string]: {
      isAvailable: boolean;
      quantity: number;
    };
  };
}

// Key: "productId_YYYY-MM-DD_slotId", Value: Max Capacity Number
export type CapacityMap = Record<string, number>;

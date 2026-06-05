import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Order, Customer, OrderItem, Product, CapacityMap } from '../types';
import { DEFAULT_PRODUCTS, DEFAULT_CAPACITY_PER_SLOT, API_BASE_URL } from '../constants';

interface OrderContextType {
  orders: Order[];
  products: Product[];
  capacities: CapacityMap;
  addOrder: (customer: Customer, items: OrderItem[]) => Promise<boolean>; // تغییر کرد به Promise
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  updateProduct: (product: Product) => void;
  addProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  updateCapacity: (productId: string, dateIso: string, slotId: string, amount: number) => void;
  getRemainingCapacity: (productId: string, dateIso: string, slotId: string) => number;
  refreshData: () => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [capacities, setCapacities] = useState<CapacityMap>({});

  // تابع برای گرفتن اطلاعات تازه از سرور
  const refreshData = async () => {
    try {
      // گرفتن محصولات از سرور جنگو
      const prodRes = await fetch(`${API_BASE_URL}/products/`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData);
      } else {
         setProducts(DEFAULT_PRODUCTS);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (products.length === 0) setProducts(DEFAULT_PRODUCTS);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // ارسال سفارش به سرور جنگو
  const addOrder = async (customer: Customer, items: OrderItem[]) => {
    try {
      const payload = {
        customer: {
            name: customer.name,
            phone: customer.phone,
            addresses: customer.addresses,
            selectedAddress: customer.selectedAddress
        },
        items: items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            dateIso: i.dateIso,
            timeSlotId: i.timeSlotId
        }))
      };

      const response = await fetch(`${API_BASE_URL}/orders/submit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || "خطا در ثبت سفارش");
        return false;
      }

      const newOrder = await response.json();
      // سفارش جدید رو به لیست محلی هم اضافه می‌کنیم تا کاربر فوراً ببینه
      setOrders(prev => [newOrder, ...prev]);
      return true;

    } catch (error) {
      console.error("Order submission failed:", error);
      alert("خطا در ارتباط با سرور");
      return false;
    }
  };

  // بقیه توابع فعلاً لوکال می‌مانند (برای سادگی فاز اول)
  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const addProduct = (product: Product) => {
    setProducts(prev => [...prev, product]);
  };

  const deleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const updateCapacity = (productId: string, dateIso: string, slotId: string, amount: number) => {
    const key = `${productId}_${dateIso}_${slotId}`;
    setCapacities(prev => ({ ...prev, [key]: amount }));
  };

  // محاسبه ظرفیت (فعلاً سمت کلاینت با داده‌های موجود)
  const getRemainingCapacity = (productId: string, dateIso: string, slotId: string) => {
    const key = `${productId}_${dateIso}_${slotId}`;
    const maxCapacity = capacities[key] !== undefined ? capacities[key] : DEFAULT_CAPACITY_PER_SLOT;
    return maxCapacity; 
  };

  return (
    <OrderContext.Provider value={{ 
      orders, 
      products, 
      capacities, 
      addOrder, 
      updateOrderStatus,
      updateProduct,
      addProduct,
      deleteProduct,
      updateCapacity,
      getRemainingCapacity,
      refreshData
    }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};
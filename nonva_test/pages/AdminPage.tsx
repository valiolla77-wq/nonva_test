import React, { useState, useMemo, useEffect } from 'react';
import { useOrders } from '../context/OrderContext';
import { TIME_SLOTS, PERSIAN_DAYS, API_BASE_URL } from '../constants';
import { analyzeProductionSchedule } from '../services/geminiService';
import { Bot, CheckCircle, Package, Settings, Calendar, Layers, Plus, Trash2, Edit2, Save, Clock, Lock, LogIn, Loader2, MapPin } from 'lucide-react';
import { Product, DeliveryDate, OrderItem, Customer } from '../types';

const AdminPage: React.FC = () => {
  const { orders, products, updateOrderStatus, updateProduct, addProduct, deleteProduct, capacities, updateCapacity } = useOrders();
  const [activeTab, setActiveTab] = useState<'orders' | 'production' | 'capacity' | 'products'>('orders');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // Capacity Tab State
  const [capacityProductId, setCapacityProductId] = useState<string>('');

  // Product Editor State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ name: '', price: 0 });

  useEffect(() => {
    const token = sessionStorage.getItem('nanoa_admin_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Initialize capacity product selection
  useEffect(() => {
    if (!capacityProductId && products.length > 0) {
      setCapacityProductId(products[0].id);
    }
  }, [products, capacityProductId]);

  // Computed Stats
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const totalRevenue = orders.reduce((acc, o) => acc + o.totalPrice, 0);

  // --- SPLIT ORDER VIEW LOGIC ---
  const splitOrders = useMemo(() => {
    const rows: Array<{
      uniqueKey: string;
      originalOrderId: string;
      customer: Customer;
      dateIso: string;
      timeSlotId: string;
      slotLabel: string | undefined;
      items: OrderItem[];
      totalPrice: number;
      status: string;
      sortTime: number;
    }> = [];

    orders.forEach(order => {
      const groups: Record<string, OrderItem[]> = {};
      order.items.forEach(item => {
        const key = `${item.dateIso}_${item.timeSlotId}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      Object.keys(groups).forEach(key => {
        const groupItems = groups[key];
        const firstItem = groupItems[0];
        const slot = TIME_SLOTS.find(s => s.id === firstItem.timeSlotId);
        const dateStr = `${firstItem.dateIso}T${slot?.hour.toString().padStart(2, '0')}:${slot?.minute.toString().padStart(2, '0')}:00`;
        
        rows.push({
          uniqueKey: `${order.id}_${key}`,
          originalOrderId: order.id,
          customer: order.customer,
          dateIso: firstItem.dateIso,
          timeSlotId: firstItem.timeSlotId,
          slotLabel: slot?.label,
          items: groupItems,
          totalPrice: groupItems.reduce((sum, i) => sum + (i.quantity * i.productPrice), 0),
          status: order.status, 
          sortTime: new Date(dateStr).getTime()
        });
      });
    });

    return rows.sort((a, b) => a.sortTime - b.sortTime);
  }, [orders]);


  const productionSchedule = useMemo(() => {
    const flatItems = orders
      .filter(o => o.status !== 'delivered') 
      .flatMap(o => o.items)
      .map(item => {
         const slot = TIME_SLOTS.find(s => s.id === item.timeSlotId);
         const dateStr = `${item.dateIso}T${slot?.hour.toString().padStart(2, '0')}:${slot?.minute.toString().padStart(2, '0')}:00`;
         return { ...item, sortTime: new Date(dateStr).getTime(), slotLabel: slot?.label };
      });
    
    flatItems.sort((a, b) => a.sortTime - b.sortTime);

    const grouped = new Map<string, {
      dateIso: string;
      timeSlotId: string;
      slotLabel: string | undefined;
      sortTime: number;
      products: Record<string, number>;
    }>();

    flatItems.forEach(item => {
      const key = `${item.dateIso}_${item.timeSlotId}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          dateIso: item.dateIso,
          timeSlotId: item.timeSlotId,
          slotLabel: item.slotLabel,
          sortTime: item.sortTime,
          products: {}
        });
      }
      const group = grouped.get(key)!;
      group.products[item.productName] = (group.products[item.productName] || 0) + item.quantity;
    });

    return Array.from(grouped.values());
  }, [orders]);

  const scheduleDays = useMemo<DeliveryDate[]>(() => {
    const days: DeliveryDate[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      days.push({
        dateObj: d,
        displayDate: d.toLocaleDateString('fa-IR'),
        dayName: PERSIAN_DAYS[d.getDay()],
      });
    }
    return days;
  }, []);

  // --- تغییر اصلی لاگین ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/admin/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username: 'admin', 
            password: passwordInput 
        })
      });

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('nanoa_admin_token', data.token);
        setIsAuthenticated(true);
        setAuthError(false);
      } else {
        setAuthError(true);
      }
    } catch (error) {
      console.error("Login error", error);
      setAuthError(true);
    }
  };

  const handleAnalyze = async () => {
    setIsLoadingAi(true);
    const result = await analyzeProductionSchedule(orders);
    setAiAnalysis(result);
    setIsLoadingAi(false);
  };

  const handleAddProduct = () => {
    if (newProduct.name && newProduct.price) {
      addProduct({
        id: Date.now().toString(),
        name: newProduct.name,
        price: Number(newProduct.price)
      });
      setNewProduct({ name: '', price: 0 });
    }
  };

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-gray-100 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ورود به پنل مدیریت</h2>
          <p className="text-gray-500 mb-8 text-sm">لطفا رمز عبور را وارد کنید</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="رمز عبور..."
              className={`w-full px-4 py-3 rounded-xl border text-center text-lg outline-none transition-all
                ${authError ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200'}
              `}
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              autoFocus
            />
            {authError && <p className="text-red-500 text-xs font-bold">رمز عبور اشتباه است</p>}
            
            <button 
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              ورود
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <header className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-1">داشبورد مدیریت</h1>
            <p className="text-gray-500 text-sm md:text-base">کنترل کامل بر سفارشات، تولید و موجودی</p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
             <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center min-w-[100px] flex-shrink-0">
               <span className="text-xs text-gray-500">سفارشات باز</span>
               <span className="font-bold text-xl md:text-2xl text-orange-600">{pendingOrdersCount}</span>
             </div>
             <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center min-w-[140px] flex-shrink-0">
               <span className="text-xs text-gray-500">درآمد کل (تومان)</span>
               <span className="font-bold text-lg md:text-xl text-green-600">{totalRevenue.toLocaleString()}</span>
             </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 border-b border-gray-200 pb-1 no-scrollbar">
          {[
            { id: 'orders', label: 'سفارشات', icon: Package },
            { id: 'production', label: 'برنامه پخت', icon: Layers },
            { id: 'capacity', label: 'ظرفیت', icon: Calendar },
            { id: 'products', label: 'محصولات', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium transition-colors whitespace-nowrap flex-shrink-0
                ${activeTab === tab.id ? 'bg-white border border-gray-200 border-b-transparent text-orange-600 relative top-[1px]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-sm border border-gray-200 min-h-[500px] p-4 md:p-6">
        
        {/* TAB: ORDERS (SPLIT VIEW) */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center">
               <h2 className="text-lg font-bold text-gray-800">لیست سفارشات</h2>
             </div>

             {/* MOBILE CARD VIEW */}
             <div className="md:hidden space-y-4">
                {splitOrders.length === 0 && (
                    <div className="text-center py-8 text-gray-400">سفارشی یافت نشد</div>
                )}
                {splitOrders.map((row) => (
                  <div key={row.uniqueKey} className="border border-gray-200 rounded-xl p-4 shadow-sm bg-gray-50/50">
                    <div className="flex justify-between items-start mb-3 border-b border-gray-200 pb-3">
                      <div className="flex flex-col">
                         <div className="flex items-center gap-2 mb-1">
                           <span className="font-bold text-gray-900">{row.slotLabel}</span>
                           <span className="text-xs text-gray-500 font-mono bg-white px-1 rounded border">{row.dateIso}</span>
                         </div>
                         <span className="text-xs text-gray-500">{row.customer.name}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold
                          ${row.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                            row.status === 'delivered' ? 'bg-gray-100 text-gray-600' : 
                            'bg-yellow-100 text-yellow-700'}
                        `}>
                          {row.status === 'confirmed' ? 'تایید شده' : 
                           row.status === 'delivered' ? 'تحویل شده' : 'در انتظار'}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                        {row.items.map((item, idx) => (
                             <div key={idx} className="text-sm flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                               <span className="text-gray-700">{item.productName}</span>
                               <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">{item.quantity} عدد</span>
                             </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{row.customer.selectedAddress || 'بدون آدرس'}</span>
                    </div>

                    <div className="flex gap-2 mt-2">
                          {row.status !== 'confirmed' && row.status !== 'delivered' && (
                            <button 
                              onClick={() => updateOrderStatus(row.originalOrderId, 'confirmed')}
                              className="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold flex items-center justify-center gap-1 hover:bg-green-100"
                            >
                              <CheckCircle className="w-4 h-4" /> تایید
                            </button>
                          )}
                          {row.status === 'confirmed' && (
                             <button 
                               onClick={() => updateOrderStatus(row.originalOrderId, 'delivered')}
                               className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold flex items-center justify-center gap-1 hover:bg-blue-100"
                             >
                               <Package className="w-4 h-4" /> تحویل
                             </button>
                          )}
                    </div>
                  </div>
                ))}
             </div>

             {/* DESKTOP TABLE VIEW */}
             <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
                  <tr>
                    <th className="px-4 py-3 rounded-r-lg">زمان تحویل</th>
                    <th className="px-4 py-3">مشتری</th>
                    <th className="px-4 py-3">اقلام سفارش</th>
                    <th className="px-4 py-3">آدرس</th>
                    <th className="px-4 py-3">وضعیت</th>
                    <th className="px-4 py-3 rounded-l-lg">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {splitOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-400">سفارشی یافت نشد</td>
                    </tr>
                  )}
                  {splitOrders.map((row) => (
                    <tr key={row.uniqueKey} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">{row.slotLabel}</span>
                          <span className="text-xs text-gray-500 font-mono">{row.dateIso}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{row.customer.name}</span>
                          <span className="text-xs text-gray-500 font-mono dir-ltr text-right">{row.customer.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                         <div className="space-y-1">
                           {row.items.map((item, idx) => (
                             <div key={idx} className="text-sm flex items-center gap-2">
                               <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">{item.quantity}x</span>
                               <span className="text-gray-700">{item.productName}</span>
                             </div>
                           ))}
                         </div>
                      </td>
                      <td className="px-4 py-4">
                         <p className="text-xs text-gray-500 max-w-[200px] truncate" title={row.customer.selectedAddress || row.customer.addresses?.[0]}>
                           {row.customer.selectedAddress || row.customer.addresses?.[0] || 'بدون آدرس'}
                         </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold
                          ${row.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                            row.status === 'delivered' ? 'bg-gray-100 text-gray-600' : 
                            'bg-yellow-100 text-yellow-700'}
                        `}>
                          {row.status === 'confirmed' ? 'تایید شده' : 
                           row.status === 'delivered' ? 'تحویل شده' : 'در انتظار'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {row.status !== 'confirmed' && row.status !== 'delivered' && (
                            <button 
                              onClick={() => updateOrderStatus(row.originalOrderId, 'confirmed')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="تایید سفارش"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                          {row.status === 'confirmed' && (
                             <button 
                               onClick={() => updateOrderStatus(row.originalOrderId, 'delivered')}
                               className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                               title="علامت به عنوان تحویل شده"
                             >
                               <Package className="w-5 h-5" />
                             </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
             </div>
          </div>
        )}

        {/* TAB: PRODUCTION SCHEDULE */}
        {activeTab === 'production' && (
          <div className="space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                 <h2 className="text-lg font-bold text-gray-800">برنامه تولید نان (Shatir AI)</h2>
                 <p className="text-sm text-gray-500">لیست تجمیعی نان‌های مورد نیاز برای هر شیفت</p>
               </div>
               <button 
                 onClick={handleAnalyze}
                 disabled={isLoadingAi}
                 className="w-full md:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-all shadow-md shadow-purple-200"
               >
                 {isLoadingAi ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                 تحلیل هوشمند
               </button>
             </div>

             {aiAnalysis && (
               <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 animate-in fade-in slide-in-from-top-4">
                 <h3 className="font-bold text-purple-800 mb-4 flex items-center gap-2">
                   <Bot className="w-5 h-5" />
                   تحلیل شاطر هوشمند
                 </h3>
                 <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                   {aiAnalysis}
                 </div>
               </div>
             )}

             <div className="grid gap-4">
               {productionSchedule.map((slot, idx) => (
                 <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:border-orange-300 transition-colors bg-white">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 mb-3 gap-3">
                      <div className="flex items-center gap-3">
                         <div className="bg-orange-100 p-2 rounded-lg text-orange-700">
                           <Clock className="w-5 h-5" />
                         </div>
                         <div>
                           <h3 className="font-bold text-gray-800 text-lg">{slot.slotLabel}</h3>
                           <p className="text-sm text-gray-500 font-mono">{slot.dateIso}</p>
                         </div>
                      </div>
                      <span className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1 rounded-full self-start sm:self-auto">
                        مجموع: {Object.values(slot.products).reduce((a, b) => a + b, 0)} نان
                      </span>
                   </div>
                   <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(slot.products).map(([name, qty]) => (
                        <div key={name} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                          <span className="text-gray-700 text-sm font-medium">{name}</span>
                          <span className="font-black text-lg text-gray-900">{qty}</span>
                        </div>
                      ))}
                   </div>
                 </div>
               ))}
               {productionSchedule.length === 0 && (
                 <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                   هیچ سفارش فعالی برای تولید وجود ندارد
                 </div>
               )}
             </div>
          </div>
        )}

        {/* TAB: CAPACITY MANAGEMENT */}
        {activeTab === 'capacity' && (
          <div className="space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h2 className="text-lg font-bold text-gray-800">مدیریت ظرفیت پخت</h2>
                  <p className="text-sm text-gray-500">تعیین حداکثر تعداد نان قابل سفارش در هر شیفت</p>
               </div>
               
               {/* Product Selector for Capacity */}
               <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto">
                 {products.map(p => (
                   <button
                     key={p.id}
                     onClick={() => setCapacityProductId(p.id)}
                     className={`px-4 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap flex-shrink-0 ${capacityProductId === p.id ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                   >
                     {p.name}
                   </button>
                 ))}
               </div>
            </div>

            <div className="overflow-x-auto">
               <table className="w-full min-w-[600px] text-center border-collapse">
                 <thead>
                   <tr className="bg-gray-50 text-gray-600 text-sm">
                     <th className="p-3 border border-gray-100 w-32">تاریخ</th>
                     {TIME_SLOTS.map(slot => (
                       <th key={slot.id} className="p-3 border border-gray-100">
                         <div className="flex flex-col">
                           <span>{slot.label}</span>
                           <span className="text-xs font-mono opacity-50">{slot.time}</span>
                         </div>
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                    {scheduleDays.map((day, dayIndex) => (
                      <tr key={dayIndex} className="hover:bg-gray-50/50">
                        <td className="p-3 border border-gray-100 font-medium bg-gray-50 text-gray-700">
                           <div className="flex flex-col text-right pr-2">
                              <span>{day.dayName}</span>
                              <span className="text-xs text-gray-400 font-mono">{day.displayDate}</span>
                           </div>
                        </td>
                        {TIME_SLOTS.map(slot => {
                          const dateIso = day.dateObj.toISOString().split('T')[0];
                          const key = `${capacityProductId}_${dateIso}_${slot.id}`;
                          const currentCap = capacities[key] !== undefined ? capacities[key] : DEFAULT_CAPACITY_PER_SLOT;
                          const isZero = currentCap === 0;

                          return (
                            <td key={slot.id} className={`p-2 border border-gray-100 ${isZero ? 'bg-red-50' : ''}`}>
                              <div className="relative group">
                                {isZero && (
                                  <Lock className="w-3 h-3 text-red-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                                )}
                                <input 
                                  type="number" 
                                  min="0"
                                  className={`w-full text-center p-2 rounded-lg border focus:ring-2 outline-none transition-all font-mono
                                    ${isZero 
                                      ? 'border-red-200 text-red-500 bg-white pl-6 focus:border-red-400 focus:ring-red-100' 
                                      : 'border-gray-200 focus:border-orange-400 focus:ring-orange-100'
                                    }
                                  `}
                                  value={currentCap}
                                  onChange={(e) => updateCapacity(capacityProductId, dateIso, slot.id, parseInt(e.target.value) || 0)}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {/* TAB: PRODUCTS MANAGEMENT */}
        {activeTab === 'products' && (
          <div className="max-w-2xl mx-auto space-y-8">
             <div>
               <h2 className="text-lg font-bold text-gray-800 mb-4">مدیریت انواع نان</h2>
               
               <div className="space-y-3">
                 {products.map(product => (
                   <div key={product.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm group">
                      {editingProduct?.id === product.id ? (
                        <div className="flex-1 flex flex-col sm:flex-row gap-2">
                           <input 
                             className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-orange-500"
                             value={editingProduct.name}
                             onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                             placeholder="نام محصول"
                           />
                           <div className="flex gap-2">
                             <input 
                               className="flex-1 sm:w-24 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-orange-500 text-center"
                               type="number"
                               value={editingProduct.price}
                               onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                               placeholder="قیمت"
                             />
                             <button 
                               onClick={() => {
                                 updateProduct(editingProduct);
                                 setEditingProduct(null);
                               }}
                               className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 flex-1 sm:flex-none flex items-center justify-center"
                             >
                               <Save className="w-4 h-4" />
                             </button>
                           </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-800">{product.name}</h3>
                            <p className="text-sm text-gray-500">{product.price.toLocaleString()} تومان</p>
                          </div>
                          <div className="flex gap-2 justify-end sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={() => setEditingProduct(product)}
                               className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                             >
                               <Edit2 className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => {
                                 if(window.confirm('آیا از حذف این محصول اطمینان دارید؟')) deleteProduct(product.id);
                               }}
                               className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                        </>
                      )}
                   </div>
                 ))}
               </div>
             </div>

             <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300">
               <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                 <Plus className="w-5 h-5" />
                 افزودن محصول جدید
               </h3>
               <div className="flex flex-col sm:flex-row gap-3">
                 <input 
                   placeholder="نام نان (مثلا: نان روغنی)"
                   className="flex-2 w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500"
                   value={newProduct.name}
                   onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                 />
                 <div className="flex gap-3">
                    <input 
                      placeholder="قیمت"
                      type="number"
                      className="flex-1 sm:w-32 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 text-center"
                      value={newProduct.price || ''}
                      onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                    />
                    <button 
                      onClick={handleAddProduct}
                      disabled={!newProduct.name || !newProduct.price}
                      className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      افزودن
                    </button>
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
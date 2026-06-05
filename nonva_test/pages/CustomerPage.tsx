import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Customer, DeliveryDate, OrderItem, Order } from '../types';
import { TIME_SLOTS, PERSIAN_DAYS } from '../constants';
import TimeSlotCell from '../components/TimeSlotCell';
import MapPicker from '../components/MapPicker';
import { useOrders } from '../context/OrderContext';
import { MapPin, User, ShoppingBag, ChevronRight, Download, CheckCircle2, Store, Edit2 } from 'lucide-react';
import html2canvas from 'html2canvas';

const CustomerPage: React.FC = () => {
  const { addOrder, products, getRemainingCapacity } = useOrders();
  
  // Customer Identity State
  const [currentUser, setCurrentUser] = useState<Customer | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Order State
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [activeProductId, setActiveProductId] = useState<string>(products[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Address State
  const [selectedAddressMode, setSelectedAddressMode] = useState<'saved' | 'new'>('saved');
  const [newAddressInput, setNewAddressInput] = useState('');
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(0);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // New State for Invoice
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Load User from LocalStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('nanoa_user_profile');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCurrentUser(parsed);
      } catch (e) {
        console.error("Error loading user profile", e);
      }
    } else {
      setIsEditingProfile(true);
    }
  }, []);

  // Save User to LocalStorage
  useEffect(() => {
    if (currentUser && !isEditingProfile) {
      localStorage.setItem('nanoa_user_profile', JSON.stringify(currentUser));
    }
  }, [currentUser, isEditingProfile]);

  useEffect(() => {
    // اگر محصول فعلی دیگر وجود ندارد (مثلا از سرور پاک شده)، اولی رو انتخاب کن
    if (!products.find(p => p.id === activeProductId) && products.length > 0) {
      setActiveProductId(products[0].id);
    } else if (activeProductId === '' && products.length > 0) {
        setActiveProductId(products[0].id);
    }
  }, [products, activeProductId]);

  const scheduleDays = useMemo<DeliveryDate[]>(() => {
    const days: DeliveryDate[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      let dayName = '';
      if (i === 0) dayName = 'امروز';
      else if (i === 1) dayName = 'فردا';
      else if (i === 2) dayName = 'پس‌فردا';
      else dayName = PERSIAN_DAYS[d.getDay()];

      days.push({
        dateObj: d,
        displayDate: d.toLocaleDateString('fa-IR'),
        dayName,
      });
    }
    return days;
  }, []);

  const activeProduct = products.find(p => p.id === activeProductId);

  const handleQuantityChange = (dateIso: string, slotId: string, quantity: number) => {
    if (!activeProduct) return;

    const remainingCap = getRemainingCapacity(activeProductId, dateIso, slotId);
    
    if (quantity > remainingCap) {
       quantity = remainingCap; 
    }

    setCartItems(prev => {
      const others = prev.filter(i => !(i.dateIso === dateIso && i.timeSlotId === slotId && i.productId === activeProductId));
      if (quantity > 0) {
        return [...others, { 
          dateIso, 
          timeSlotId: slotId, 
          productId: activeProductId, 
          quantity,
          productName: activeProduct.name,
          productPrice: activeProduct.price
        }];
      }
      return others;
    });
  };

  const getQuantityInCart = (dateIso: string, slotId: string) => {
    return cartItems.find(i => i.dateIso === dateIso && i.timeSlotId === slotId && i.productId === activeProductId)?.quantity || 0;
  };

  const isSlotAvailable = (date: Date, slotHour: number, slotMinute: number) => {
    const now = new Date();
    const slotTime = new Date(date);
    slotTime.setHours(slotHour, slotMinute, 0, 0);
    const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    return slotTime > twelveHoursFromNow;
  };

  const totalInvoicePrice = cartItems.reduce((sum, item) => sum + (item.quantity * item.productPrice), 0);

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    
    if (currentUser) {
      setCurrentUser({ ...currentUser, name, phone });
    } else {
      setCurrentUser({
        id: Date.now().toString(),
        name,
        phone,
        addresses: []
      });
    }
    setIsEditingProfile(false);
  };

  const handleAddressFromMap = (address: string) => {
    setNewAddressInput(address);
    setSelectedAddressMode('new');
    setShowMapPicker(false);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (cartItems.length === 0) {
      alert('لطفا حداقل یک نوبت را انتخاب کنید.');
      return;
    }

    let finalAddress = '';
    let updatedUser = { ...currentUser };

    if (selectedAddressMode === 'new') {
      if (!newAddressInput.trim()) {
        alert('لطفا آدرس جدید را وارد کنید');
        return;
      }
      finalAddress = newAddressInput.trim();
      updatedUser.addresses = [...updatedUser.addresses, finalAddress];
    } else {
       if (updatedUser.addresses.length === 0) {
          alert("لطفا یک آدرس وارد کنید");
          return;
       }
       finalAddress = updatedUser.addresses[selectedAddressIndex] || updatedUser.addresses[0];
    }

    setIsSubmitting(true);
    
    setCurrentUser(updatedUser);
    localStorage.setItem('nanoa_user_profile', JSON.stringify(updatedUser));

    const orderCustomer: Customer = {
      ...updatedUser,
      selectedAddress: finalAddress
    };

    // --- اتصال به سرور ---
    const success = await addOrder(orderCustomer, cartItems);
    
    if (success) {
      const simulatedOrder: Order = {
          id: "Registered-On-Server",
          customer: orderCustomer,
          items: cartItems,
          createdAt: new Date().toISOString(),
          status: 'pending',
          totalPrice: totalInvoicePrice
      };

      setLastOrder(simulatedOrder);
      setCartItems([]);
      setNewAddressInput('');
      setSelectedAddressMode('saved');
      window.scrollTo(0, 0);
    }
    
    setIsSubmitting(false);
  };

  const handleDownloadInvoice = async () => {
    if (!invoiceRef.current) return;
    try {
      const canvas = await html2canvas(invoiceRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      link.download = `nanoa-invoice-${lastOrder?.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Failed to generate invoice", err);
      alert("متاسفانه در دانلود فاکتور مشکلی پیش آمد.");
    }
  };

  // --- 1. LOGIN / EDIT PROFILE VIEW ---
  if (isEditingProfile || !currentUser) {
    return (
      <div className="max-w-md mx-auto pt-10 pb-20 px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
             <User className="w-10 h-10 text-orange-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {currentUser ? 'ویرایش مشخصات' : 'خوش آمدید'}
          </h1>
          <p className="text-gray-500 mb-8 text-sm">برای ثبت سفارش لطفا مشخصات خود را وارد کنید. این اطلاعات برای سفارش‌های بعدی ذخیره می‌شود.</p>
          
          <form onSubmit={handleProfileSubmit} className="space-y-5 text-right">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">نام و نام خانوادگی</label>
              <input 
                name="name"
                required
                defaultValue={currentUser?.name}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none bg-gray-50 focus:bg-white transition-all"
                placeholder="مثلا: علی محمدی"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">شماره تماس</label>
              <input 
                name="phone"
                required
                defaultValue={currentUser?.phone}
                dir="ltr"
                type="tel"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none bg-gray-50 focus:bg-white transition-all text-right"
                placeholder="0912..."
              />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-orange-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 hover:-translate-y-1 transition-all active:scale-95">
              {currentUser ? 'ذخیره تغییرات' : 'ورود به سامانه'}
            </button>
            {currentUser && (
               <button 
                 type="button"
                 onClick={() => setIsEditingProfile(false)}
                 className="w-full text-gray-500 font-medium py-2 hover:text-gray-800 transition-colors"
               >
                 انصراف
               </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // --- 2. RECEIPT VIEW ---
  if (lastOrder) {
    return (
      <div className="max-w-xl mx-auto pt-8 pb-20 px-4 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">سفارش با موفقیت ثبت شد</h1>
        </div>

        <div className="flex justify-center gap-4 mb-8 no-print">
           <button 
             onClick={handleDownloadInvoice}
             className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all"
           >
             <Download className="w-5 h-5" />
             دانلود تصویر
           </button>
           <button 
             onClick={() => setLastOrder(null)}
             className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl font-medium transition-all"
           >
             ثبت سفارش جدید
           </button>
        </div>

        {/* INVOICE DOM ELEMENT */}
        <div ref={invoiceRef} className="bg-white relative overflow-hidden shadow-2xl receipt-jagged-edge mx-auto">
          {/* Top Accent */}
          <div className="h-3 w-full bg-orange-600"></div>
          
          {/* Paper Body */}
          <div className="bg-receipt-texture p-8 text-gray-900">
             
             {/* Header */}
             <div className="flex flex-col items-center mb-8 pb-6 border-b-2 border-dashed border-gray-300">
                <div className="border-2 border-gray-900 p-3 rounded-full mb-3">
                  <Store className="w-8 h-8 text-gray-900" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">نانوایی نانوا</h2>
                <p className="text-gray-600 font-medium">رسید سفارش آنلاین</p>
                <div className="mt-4 text-sm font-mono text-gray-500 flex items-center gap-3 bg-white px-3 py-1 rounded border border-gray-200">
                   <span>{new Date().toLocaleDateString('fa-IR')}</span>
                   <span className="text-gray-300">|</span>
                   <span>{new Date().toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
             </div>

             {/* Customer Info */}
             <div className="mb-8 space-y-4">
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-2 border-dashed">
                   <span className="text-gray-500 text-sm font-medium">مشتری</span>
                   <span className="font-bold text-lg">{lastOrder.customer.name}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-2 border-dashed">
                   <span className="text-gray-500 text-sm font-medium">شماره تماس</span>
                   <span className="font-bold text-lg font-mono dir-ltr">{lastOrder.customer.phone}</span>
                </div>
                <div className="pt-1">
                   <span className="block text-gray-500 text-sm font-medium mb-1">آدرس تحویل</span>
                   <p className="font-medium text-gray-800 leading-relaxed text-sm bg-gray-50 p-3 rounded border border-gray-200">
                     {lastOrder.customer.selectedAddress || (lastOrder.customer.addresses && lastOrder.customer.addresses[0])}
                   </p>
                </div>
             </div>

             {/* Items Table */}
             <div className="mb-8">
               <table className="w-full text-sm">
                 <thead className="text-gray-500 text-xs uppercase border-b-2 border-gray-800">
                    <tr>
                       <th className="pb-2 text-right font-bold">شرح</th>
                       <th className="pb-2 text-center font-bold">تعداد</th>
                       <th className="pb-2 text-left font-bold">فی</th>
                       <th className="pb-2 text-left font-bold">جمع کل</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-dashed divide-gray-300">
                   {lastOrder.items.map((item, idx) => (
                     <tr key={idx}>
                       <td className="py-3 align-top">
                         <div className="font-bold text-gray-900">{item.productName}</div>
                         <div className="text-[11px] text-gray-500 mt-1 font-medium">
                            {item.dateIso} <span className="mx-1">•</span> {TIME_SLOTS.find(t => t.id === item.timeSlotId)?.label}
                         </div>
                       </td>
                       <td className="py-3 text-center align-top font-black text-lg">{item.quantity}</td>
                       <td className="py-3 text-left align-top text-gray-600">{item.productPrice.toLocaleString()}</td>
                       <td className="py-3 text-left align-top font-bold text-gray-900">{(item.quantity * item.productPrice).toLocaleString()}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>

             {/* Totals */}
             <div className="border-t-2 border-gray-900 pt-4 space-y-2">
                <div className="flex justify-between text-gray-600 text-sm">
                   <span>جمع کل اقلام</span>
                   <span>{lastOrder.totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-4 mt-4 border-t border-dashed border-gray-300">
                   <span className="font-bold text-xl text-gray-900">مبلغ پرداختی</span>
                   <div className="text-right">
                      <span className="block font-black text-3xl text-gray-900">{lastOrder.totalPrice.toLocaleString()}</span>
                      <span className="text-xs text-gray-500">تومان</span>
                   </div>
                </div>
             </div>
             
             {/* Footer / Barcode */}
             <div className="mt-10 pt-6 border-t border-gray-200 text-center">
                <div className="text-[10px] text-gray-400 mb-2 font-mono uppercase tracking-widest">Order ID: {lastOrder.id}</div>
                {/* Fake Barcode */}
                <div className="h-14 w-3/4 mx-auto bg-transparent mb-4" style={{backgroundImage: 'repeating-linear-gradient(90deg, #000, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 8px, transparent 8px, transparent 9px)'}}></div>
                <p className="text-sm font-bold text-gray-800">از خرید شما سپاسگزاریم</p>
                <p className="text-xs text-gray-500 mt-1">لطفا هنگام تحویل این رسید را به همراه داشته باشید</p>
             </div>
          </div>
        </div>
        <div className="h-8 w-full"></div> {/* Spacer for bottom edge */}
      </div>
    );
  }

  // --- 3. MAIN ORDER FORM ---
  return (
    <div className="max-w-6xl mx-auto pb-36 md:pb-32">
      {showMapPicker && (
        <MapPicker 
          onConfirm={handleAddressFromMap} 
          onCancel={() => setShowMapPicker(false)} 
        />
      )}

      <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4 px-4 md:px-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 text-center md:text-right">ثبت سفارش نان تازه</h1>
          <p className="text-gray-500 text-sm md:text-base text-center md:text-right">خوش آمدید، <span className="font-bold text-gray-800">{currentUser.name}</span></p>
        </div>
        <button 
          onClick={() => setIsEditingProfile(true)}
          className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Edit2 className="w-4 h-4" />
          ویرایش مشخصات
        </button>
      </header>

      <form onSubmit={handleSubmitOrder} className="grid lg:grid-cols-12 gap-6 md:gap-8 px-4 md:px-0">
        
        {/* Left Sidebar: Info & Invoice (Desktop) / Bottom (Mobile) */}
        <div className="lg:col-span-4 space-y-6 h-fit lg:sticky lg:top-24 order-last lg:order-first">
          
          {/* Delivery Address Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              آدرس تحویل
            </h2>
            
            <div className="space-y-4">
              {currentUser.addresses.length > 0 && (
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAddressMode('saved')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${selectedAddressMode === 'saved' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    آدرس‌های ذخیره
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAddressMode('new')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${selectedAddressMode === 'new' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    آدرس جدید
                  </button>
                </div>
              )}

              {selectedAddressMode === 'saved' && currentUser.addresses.length > 0 ? (
                <div className="space-y-2">
                   <label className="text-sm text-gray-600 block">انتخاب آدرس:</label>
                   <select 
                     className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none text-sm"
                     value={selectedAddressIndex}
                     onChange={(e) => setSelectedAddressIndex(Number(e.target.value))}
                   >
                     {currentUser.addresses.map((addr, idx) => (
                       <option key={idx} value={idx}>{addr.substring(0, 40)}{addr.length > 40 ? '...' : ''}</option>
                     ))}
                   </select>
                   <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-200 break-words leading-relaxed">
                     {currentUser.addresses[selectedAddressIndex] || currentUser.addresses[0]}
                   </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {currentUser.addresses.length === 0 ? 'لطفا آدرس خود را وارد کنید' : 'آدرس جدید'}
                  </label>
                  <textarea
                    required={selectedAddressMode === 'new' || currentUser.addresses.length === 0}
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all outline-none bg-gray-50 focus:bg-white resize-none mb-2"
                    placeholder="آدرس دقیق پستی..."
                    value={newAddressInput}
                    onChange={e => {
                       setNewAddressInput(e.target.value);
                       if (selectedAddressMode === 'saved' && currentUser.addresses.length === 0) setSelectedAddressMode('new');
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    انتخاب از روی نقشه
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Live Invoice (Desktop view - hidden on mobile) */}
          <div className="hidden lg:block bg-white p-6 rounded-2xl shadow-sm border border-gray-100 ring-1 ring-orange-100">
             <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
               <ShoppingBag className="w-5 h-5 text-orange-500" />
               فاکتور سفارش
             </h2>
             
             <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar mb-4">
               {cartItems.length === 0 ? (
                 <div className="text-center text-gray-400 py-4 text-sm">سبد خرید خالی است</div>
               ) : (
                 products.map(p => {
                   const itemsForProduct = cartItems.filter(i => i.productId === p.id);
                   const totalQty = itemsForProduct.reduce((a, b) => a + b.quantity, 0);
                   if (totalQty === 0) return null;
                   return (
                     <div key={p.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                        <div>
                          <span className="font-medium text-gray-800">{p.name}</span>
                          <div className="text-xs text-gray-500 mt-0.5">{totalQty} عدد × {p.price.toLocaleString()}</div>
                        </div>
                        <span className="font-bold text-gray-900">{(totalQty * p.price).toLocaleString()}</span>
                     </div>
                   );
                 })
               )}
             </div>

             <div className="pt-4 border-t border-gray-100">
               <div className="flex justify-between items-center mb-4">
                 <span className="text-gray-600">مبلغ قابل پرداخت:</span>
                 <span className="font-black text-2xl text-orange-600">
                   {totalInvoicePrice.toLocaleString()} <span className="text-sm font-normal text-gray-500">تومان</span>
                 </span>
               </div>
               <button
                 type="submit"
                 disabled={isSubmitting || cartItems.length === 0}
                 className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-1 transition-all duration-300 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
               >
                 {isSubmitting ? 'در حال ثبت...' : 'تایید و پرداخت'}
               </button>
             </div>
          </div>
        </div>

        {/* Right Side: Product & Schedule */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Product Selection Tabs */}
          <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 flex overflow-x-auto gap-2 sticky top-16 lg:top-0 z-20 no-scrollbar pb-2 md:pb-2">
            {products.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveProductId(p.id)}
                className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 flex flex-col items-center gap-1 flex-shrink-0
                  ${activeProductId === p.id 
                    ? 'bg-orange-500 text-white shadow-md transform scale-100' 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <span>{p.name}</span>
                <span className={`text-xs ${activeProductId === p.id ? 'text-orange-100' : 'text-gray-400'}`}>
                  {p.price.toLocaleString()} تومان
                </span>
              </button>
            ))}
          </div>

          {/* Schedule Grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
                   <ChevronRight className="w-5 h-5 text-gray-400" />
                   زمان تحویل: <span className="text-orange-600">{activeProduct?.name}</span>
                </h2>
                <div className="flex flex-wrap gap-3 text-[10px] md:text-xs text-gray-500">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-sm"></span> قابل سفارش</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 md:w-3 md:h-3 bg-red-50 rounded-sm opacity-80"></span> تکمیل</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 md:w-3 md:h-3 bg-gray-200 rounded-sm"></span> بسته</div>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[600px] text-center border-collapse">
                <thead>
                  <tr className="bg-orange-100 text-orange-900">
                    <th className="p-3 font-bold text-sm border-l border-white/20 w-24 md:w-32">تاریخ</th>
                    {TIME_SLOTS.map(slot => (
                      <th key={slot.id} className="p-2 border-l border-white/20 last:border-l-0">
                        <div className="flex flex-col">
                          <span className="font-bold text-xs md:text-sm">{slot.label}</span>
                          <span className="text-[10px] md:text-xs opacity-75 mt-0.5 font-mono">{slot.time}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduleDays.map((day, dayIndex) => (
                    <tr key={dayIndex} className="border-b border-gray-100 last:border-0">
                      <td className="p-2 md:p-3 bg-orange-50/50 font-medium text-gray-700 border-l border-gray-200">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-sm md:text-lg mb-1">{day.dayName}</span>
                          <span className="text-[10px] md:text-xs text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-sm whitespace-nowrap">{day.displayDate}</span>
                        </div>
                      </td>
                      {TIME_SLOTS.map(slot => {
                         const timeValid = isSlotAvailable(day.dateObj, slot.hour, slot.minute);
                         const dateIso = day.dateObj.toISOString().split('T')[0];
                         const remaining = getRemainingCapacity(activeProductId, dateIso, slot.id);
                         
                         let status: 'available' | 'full' | 'closed' = 'available';
                         if (!timeValid) status = 'closed';
                         else if (remaining <= 0) status = 'full';
                         
                         return (
                           <td key={slot.id} className="p-1 relative group align-middle">
                             <TimeSlotCell
                               status={status}
                               isSelected={getQuantityInCart(dateIso, slot.id) > 0}
                               quantity={getQuantityInCart(dateIso, slot.id)}
                               maxAllowed={remaining}
                               onSelect={() => handleQuantityChange(dateIso, slot.id, 1)}
                               onChangeQuantity={(qty) => handleQuantityChange(dateIso, slot.id, qty)}
                             />
                             {status === 'available' && remaining < 10 && (
                               <div className="absolute top-0 right-0 bg-orange-500 text-white text-[9px] px-1.5 rounded-bl-md pointer-events-none z-20 shadow-sm">
                                  {remaining}
                               </div>
                             )}
                           </td>
                         );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Footer Checkout */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 lg:hidden flex items-center justify-between shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] pb-8">
           <div>
             <div className="text-xs text-gray-500 mb-0.5">مبلغ قابل پرداخت</div>
             <div className="font-black text-xl text-orange-600">{totalInvoicePrice.toLocaleString()} <span className="text-xs font-normal text-gray-400">تومان</span></div>
           </div>
           <button
              type="submit"
              disabled={isSubmitting || cartItems.length === 0}
              className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:grayscale disabled:hover:translate-y-0 disabled:hover:shadow-none"
           >
             {isSubmitting ? '...' : 'تایید و پرداخت'}
           </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerPage;
import { Product, TimeSlot } from './types';

// این خط جدید اضافه شده: آدرس سرور جنگوی تو
export const API_BASE_URL = 'http://127.0.0.1:8000/api'; 

export const TIME_SLOTS: TimeSlot[] = [
  { id: 'morning', label: 'صبح', 'time': '۰۶:۳۰', 'hour': 6, 'minute': 30 },
  { id: 'mid_morning', 'label': 'نیمروز', 'time': '۰۹:۰۰', 'hour': 9, 'minute': 0 },
  { id: 'noon', 'label': 'ظهر', 'time': '۱۲:۰۰', 'hour': 12, 'minute': 0 },
  { id: 'afternoon', 'label': 'عصر', 'time': '۱۶:۳۰', 'hour': 16, 'minute': 30 },
  { id: 'night', 'label': 'شب', 'time': '۲۱:۰۰', 'hour': 21, 'minute': 0 },
];

export const PERSIAN_DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

// این محصولات دیفالت هستند و اگر سرور قطع باشه استفاده می‌شن
export const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'نان لواش تنوری با آرد دیم', price: 15000 },
  { id: '2', name: 'نان لواش ماشینی با آرد سفید', price: 10000 },
];

export const DEFAULT_CAPACITY_PER_SLOT = 50;

export const ADMIN_PASSWORD = 'admin'; 
export const DEFAULT_MAP_CENTER: [number, number] = [36.222066, 58.796892]; // نیشابور
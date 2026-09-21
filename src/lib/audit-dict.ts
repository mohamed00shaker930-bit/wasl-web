export const TABLE_LABELS_AR: Record<string, string> = {
  orders: "الطلبات",
  order_items: "عناصر الطلبات",
  products: "المنتجات",
  stores: "المتاجر",
  profiles: "الملفات الشخصية",
  categories: "الفئات",
  catalog_categories: "فئات المكتبة",
  catalog_items: "منتجات المكتبة",
  credit_accounts: "حسابات الأجل",
  credit_transactions: "معاملات الأجل",
  wallets: "المحافظ",
  wallet_transactions: "معاملات المحفظة",
  locations: "العناوين",
  favorites: "المفضلة",
  ratings: "التقييمات",
  customer_ratings: "تقييمات العملاء",
  banners: "البنرات",
  business_categories: "فئات الأنشطة",
  product_offers: "العروض",
  custom_product_requests: "طلبات منتجات خاصة",
  pending_customers: "عملاء معلّقون",
  app_settings: "إعدادات التطبيق",
  app_admins: "مدراء التطبيق",
  user_roles: "أدوار المستخدمين",
};

export const ROLE_LABELS_AR: Record<string, string> = {
  customer: "عميل",
  merchant: "تاجر",
  admin: "مدير",
  super_admin: "مدير عام",
  operations: "عمليات",
  support: "دعم فني",
  finance: "مالية",
  system: "النظام",
  unknown: "غير معروف",
};

export const FIELD_LABELS_AR: Record<string, string> = {
  name: "الاسم",
  phone: "الجوال",
  price: "السعر",
  qty: "الكمية",
  total: "الإجمالي",
  status: "الحالة",
  account_status: "حالة الحساب",
  balance: "الرصيد",
  amount: "المبلغ",
  note: "ملاحظة",
  role: "الدور",
  barcode: "الباركود",
  image_url: "الصورة",
  category_id: "الفئة",
  store_id: "المتجر",
  customer_id: "العميل",
  is_open: "مفتوح",
  is_active: "مفعّل",
  return_status: "حالة الإرجاع",
  return_reason: "سبب الإرجاع",
  commission_pct: "نسبة العمولة",
  commission_amount: "قيمة العمولة",
  payment_method: "طريقة الدفع",
  channel: "القناة",
  address: "العنوان",
  area: "المنطقة",
  city: "المدينة",
  rating: "التقييم",
  stars: "النجوم",
  default_price: "السعر الافتراضي",
  usage_count: "مرات الاستخدام",
  sort_order: "الترتيب",
  slug: "المعرّف",
  name_ar: "الاسم بالعربية",
  business_category_id: "فئة النشاط",
  credit_status: "حالة الأجل",
  discount_price: "سعر العرض",
  starts_at: "يبدأ",
  ends_at: "ينتهي",
  max_qty: "حد الكمية",
  sold_qty: "المباع",
  active: "مفعّل",
  key: "المفتاح",
  value: "القيمة",
};

export function tableLabel(name: string): string {
  return TABLE_LABELS_AR[name] || name;
}
export function roleLabel(role: string | null | undefined): string {
  if (!role) return ROLE_LABELS_AR.unknown;
  return ROLE_LABELS_AR[role] || role;
}
export function fieldLabel(name: string): string {
  return FIELD_LABELS_AR[name] || name;
}

export function formatAuditValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  const s = String(v);
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

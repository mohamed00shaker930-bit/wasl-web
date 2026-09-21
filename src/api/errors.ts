import { ApiError } from "./client";

/** Arabic messages for the API's machine-readable codes (the API never sends prose). */
const AR: Record<string, string> = {
  invalid_credentials: "رقم الجوال أو كلمة المرور غير صحيحة",
  account_pending: "حسابك قيد المراجعة، سيتم تفعيله من الإدارة قريباً",
  account_rejected: "تم رفض طلب حسابك، تواصل مع الدعم",
  account_suspended: "حسابك موقوف مؤقتاً، تواصل مع الدعم",
  account_deleted: "هذا الحساب محذوف",
  force_password_change: "يجب تغيير كلمة المرور أولاً",
  invalid_token: "انتهت الجلسة، سجّل الدخول مرة أخرى",
  token_reused: "انتهت الجلسة، سجّل الدخول مرة أخرى",
  forbidden: "ليس لديك صلاحية لهذا الإجراء",
  not_found: "العنصر غير موجود",
  invalid_phone: "رقم الجوال غير صحيح (9 أرقام يبدأ بـ 77/78/71/73)",
  weak_password: "كلمة المرور قصيرة (6 أحرف على الأقل)",
  name_required: "الاسم مطلوب",
  business_required: "اسم النشاط التجاري مطلوب",
  phone_taken: "رقم الجوال مسجّل مسبقاً",
  bundle_not_found: "حزمة الصلاحيات غير موجودة",
  validation: "تحقق من البيانات المدخلة",
  cart_empty: "سلتك فارغة",
  store_missing: "لم يتم تحديد البقالة",
  store_not_active: "هذه البقالة غير متاحة حالياً",
  landmark_required: "اكتب وصف موقع التوصيل",
  invalid_total: "قيمة الطلب غير صحيحة",
  product_unknown: "أحد المنتجات لم يعد متوفراً",
  product_out_of_stock: "أحد المنتجات نفد من المخزون",
  wallet_insufficient: "رصيد المحفظة غير كافٍ",
  wallet_missing: "لا توجد محفظة",
  credit_tx_not_pending: "هذه العملية ليست بانتظار الموافقة",
  invalid_status_transition: "لا يمكن الانتقال لهذه الحالة",
  return_not_allowed: "لا يمكن طلب إرجاع لهذا الطلب",
  already_rated: "تم تقييم هذا الطلب مسبقاً",
  file_too_large: "الملف كبير جداً (الحد 5 م.ب)",
  unsupported_file: "نوع الملف غير مدعوم",
  rate_limited: "محاولات كثيرة، انتظر قليلاً",
  conflict: "تعذر تنفيذ الإجراء (تعارض)",
  internal: "حدث خطأ غير متوقع",
  network: "تعذر الاتصال بالخادم",
};

export function errorMessage(e: unknown, fallback = AR.internal): string {
  if (e instanceof ApiError) return AR[e.code] ?? fallback;
  if (e instanceof TypeError) return AR.network;
  if (e instanceof Error && /fetch|network/i.test(e.message)) return AR.network;
  return fallback;
}
export const isNetworkError = (e: unknown) => e instanceof TypeError || (e instanceof Error && !(e instanceof ApiError) && /fetch|network|load failed/i.test(e.message));

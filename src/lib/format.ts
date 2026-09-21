export function fmtRial(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return "0 ر.ي";
  return `${v.toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ر.ي`;
}

import { formatDateTime } from "./dateFormat";
export function fmtDate(d: string | Date): string {
  return formatDateTime(d);
}
export { formatDate, formatDateTime, formatTime, formatTimeAgo } from "./dateFormat";

export const STATUS_LABEL: Record<string, string> = {
  sent: "مُرسل",
  accepted: "مقبول",
  preparing: "قيد التحضير",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التوصيل",
  declined: "مرفوض",
  cancelled: "ملغي",
};

export const STATUS_ORDER = ["sent", "accepted", "preparing", "out_for_delivery", "delivered"] as const;

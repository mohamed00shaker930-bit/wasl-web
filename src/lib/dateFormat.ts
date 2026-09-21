// دوال عرض التواريخ الموحّدة — دائماً بتوقيت اليمن وأرقام لاتينية مع أسماء الشهور بالعربية.
const TZ = "Asia/Aden";
const LOCALE = "ar-u-nu-latn";

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateTimeFullDateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFullTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDateTimeFull(d: string | number | Date): string {
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return "";
  return `${dateTimeFullDateFmt.format(dt)} - ${dateTimeFullTimeFmt.format(dt)}`;
}

function toDate(d: string | number | Date): Date {
  return d instanceof Date ? d : new Date(d);
}

export function formatDate(d: string | number | Date): string {
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return "";
  return dateFmt.format(dt);
}

export function formatDateTime(d: string | number | Date): string {
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return "";
  return dateTimeFmt.format(dt);
}

export function formatTime(d: string | number | Date): string {
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return "";
  return timeFmt.format(dt);
}

export function formatTimeAgo(d: string | number | Date): string {
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return "";
  const diffSec = Math.round((Date.now() - dt.getTime()) / 1000);
  if (diffSec < 45) return "الآن";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    if (diffMin === 1) return "منذ دقيقة";
    if (diffMin === 2) return "منذ دقيقتين";
    if (diffMin <= 10) return `منذ ${diffMin} دقائق`;
    return `منذ ${diffMin} دقيقة`;
  }
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    if (diffHr === 1) return "منذ ساعة";
    if (diffHr === 2) return "منذ ساعتين";
    if (diffHr <= 10) return `منذ ${diffHr} ساعات`;
    return `منذ ${diffHr} ساعة`;
  }
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "أمس";
  if (diffDay === 2) return "قبل يومين";
  if (diffDay <= 7) return `منذ ${diffDay} أيام`;
  return formatDate(dt);
}

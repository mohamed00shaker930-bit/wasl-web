/** Deep camelCase → snake_case key mapping. API rows come out of Drizzle in camelCase; the existing UI reads snake_case. */
const toSnakeKey = (k: string) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
export function snake<T = any>(v: unknown): T {
  if (Array.isArray(v)) return v.map(snake) as T;
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[toSnakeKey(k)] = snake(val);
    return out as T;
  }
  return v as T;
}

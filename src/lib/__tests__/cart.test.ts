import { describe, it, expect, beforeEach } from "vitest";
import { cart, type CartItem } from "@/lib/cart";

const item = (id: string, price: number, qty = 1): CartItem => ({
  productId: id,
  name: `صنف ${id}`,
  price,
  qty,
});

describe("السلة — مسار الدفع", () => {
  beforeEach(() => localStorage.clear());

  it("تبدأ فارغة وبإجمالي صفر", () => {
    expect(cart.total()).toBe(0);
  });

  it("تجمع الكمية عند إضافة نفس الصنف مرتين", () => {
    cart.add("s1", "بقالة 1", item("p1", 500, 2));
    cart.add("s1", "بقالة 1", item("p1", 500, 3));
    expect(cart.total()).toBe(2500);
  });

  it("تحسب الإجمالي لأصناف متعددة", () => {
    cart.add("s1", "بقالة 1", item("p1", 500, 2));
    cart.add("s1", "بقالة 1", item("p2", 1250, 4));
    expect(cart.total()).toBe(1000 + 5000);
  });

  it("تُفرغ السلة عند التبديل إلى بقالة أخرى (لا خلط بين متجرين)", () => {
    cart.add("s1", "بقالة 1", item("p1", 500, 2));
    cart.add("s2", "بقالة 2", item("p9", 300, 1));
    expect(cart.total()).toBe(300);
  });

  it("setQty إلى صفر يحذف الصنف ويصفّر المتجر", () => {
    cart.add("s1", "بقالة 1", item("p1", 500, 2));
    cart.setQty("p1", 0);
    expect(cart.total()).toBe(0);
    const raw = JSON.parse(localStorage.getItem("baqalati_cart_v1")!);
    expect(raw.storeId).toBeNull();
    expect(raw.items).toHaveLength(0);
  });

  it("remove يحذف صنفاً واحداً ويبقي الباقي", () => {
    cart.add("s1", "بقالة 1", item("p1", 500, 2));
    cart.add("s1", "بقالة 1", item("p2", 1000, 1));
    cart.remove("p1");
    expect(cart.total()).toBe(1000);
  });

  it("clear يفرغ السلة بالكامل", () => {
    cart.add("s1", "بقالة 1", item("p1", 500, 2));
    cart.clear();
    expect(cart.total()).toBe(0);
  });

  it("لا تنهار أمام تخزين تالف", () => {
    localStorage.setItem("baqalati_cart_v1", "{not-json");
    expect(() => cart.total()).not.toThrow();
    expect(cart.total()).toBe(0);
  });
});

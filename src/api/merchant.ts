/**
 * Merchant-area row types for wasl-api (new helper file, see docs/REWRITE-GUIDE.md).
 * Rows come out of Drizzle in camelCase and numeric columns arrive as strings ("1900.00") — wrap with Number().
 * Field names mirror ../wasl-api/src/db/schema/tables.ts; do not invent fields here.
 */
import { http } from "./client";

export type OrderStatus = "sent" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "declined" | "cancelled";
export type PaymentMethod = "cash" | "credit" | "wallet" | "jeeb" | "jawali" | "hasab" | "onecash";
export type CreditStatus = "pending" | "approved" | "declined" | null;
export type ReturnStatus = "none" | "requested" | "approved" | "rejected";

export interface StoreRow {
  id: string; ownerId: string; name: string; area: string | null; lat: number | null; lng: number | null;
  isOpen: boolean; rating: string; ratingCount: number; deliveryInfo: string | null; phone: string | null;
  imageUrl: string | null; status: string; commissionPct: string | null; businessCategoryId: string | null; createdAt: string;
}

export interface OrderItemRow { id: string; orderId: string; productId: string | null; name: string; price: string; qty: number; note: string | null }

export interface MerchantOrder {
  id: string; customerId: string; storeId: string; total: string; paymentMethod: PaymentMethod; creditStatus: CreditStatus;
  status: OrderStatus; note: string | null; locationLabel: string | null; locationLandmark: string | null; locationPhone: string | null;
  locationLat: number | null; locationLng: number | null; createdAt: string; updatedAt: string; channel: "online" | "in_store";
  returnStatus: ReturnStatus; returnReason: string | null; returnRequestedAt: string | null; returnRespondedAt: string | null;
  commissionPct: string; commissionAmount: string; items: OrderItemRow[];
}

export interface ProductRow {
  id: string; storeId: string; categoryId: string | null; name: string; imageUrl: string | null; price: string; inStock: boolean;
  createdAt: string; barcode: string | null; libCategory: string | null; mainSection: string | null; subcategory: string | null;
}
export interface CategoryRow { id: string; storeId: string; name: string; sortOrder: number; createdAt: string }
export interface OfferRow {
  id: string; productId: string; storeId: string; discountPrice: string; startsAt: string; endsAt: string | null;
  maxQty: number | null; soldQty: number; active: boolean; createdAt: string;
}

export interface CustomRequestRow {
  id: string; customerId: string; storeId: string; name: string; description: string | null; qty: number; imageUrl: string | null;
  merchantPrice: string | null; merchantNote: string | null; status: "pending" | "quoted" | "accepted" | "rejected" | "converted";
  orderId: string | null; createdAt: string; updatedAt: string;
}

export interface CreditAccountRow { id: string; customerId: string; balance: string; createdAt?: string; customerName: string | null; customerPhone: string | null }
export interface CreditTxRow { id: string; accountId: string; type: "charge" | "payment"; amount: string; note: string | null; orderId: string | null; createdAt: string; status: "pending" | "approved" | "rejected" }
export interface CreditAccountDetail extends CreditAccountRow { transactions: CreditTxRow[] }

export interface PosSnapshot {
  at: string;
  products: ProductRow[];
  customers: { id: string; name: string | null; phone: string | null; kind: "registered" | "pending"; accountId: string | null; balance: string | null }[];
}

export interface DashboardStats { new_orders: number; today_orders: number; today_revenue: number; pending_returns: number; credit_outstanding: number }

export interface ReportSummary {
  from: string; to: string; orders: number; delivered: number; cancelled: number; revenue: number; average_order: number;
  online: number; in_store: number; by_payment: Record<string, { count: number; total: number }>;
  top_products: { name: string; qty: number; total: number }[]; commission: number;
}

export interface CatalogCategoryRow {
  id: string; name: string; icon: string | null; imageUrl: string | null; mainSection: string | null; parentCategory: string | null;
  sortOrder: number; usageCount: number; itemsCount: number;
}
export interface CatalogItemRow {
  id: string; name: string; defaultPrice: string; imageUrl: string | null; barcode: string | null; categoryName: string | null;
  usageCount: number; source: string; createdAt: string; categoryId: string | null; categoryPath: string | null; description: string;
  mainSection: string | null; subcategory: string | null; sortOrder: number;
}

/** GET /merchant/orders?status&from&to&channel&limit (limit max 500, default 100). */
export const fetchMerchantOrders = (query?: { status?: OrderStatus; from?: string; to?: string; channel?: "online" | "in_store"; limit?: number }) =>
  http.get<MerchantOrder[]>("/merchant/orders", query);

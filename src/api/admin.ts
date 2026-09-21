/**
 * Admin-only helpers on top of the generic HTTP client: shared response types for /admin/* and /catalog/* plus the
 * few call patterns several admin screens repeat (paged user search, permission catalog, "fetch every catalog item").
 * Rows are camelCase (Drizzle); numeric columns arrive as strings and are wrapped with Number() at the call site.
 */
import { http } from "./client";
import type { MeResponse } from "@/auth/store";

/** Replaces the `my_permissions` RPC check: super admins pass everything, staff need the explicit permission. */
export const hasPerm = (me: MeResponse | null, perm: string) => !!me && (me.super || me.perms.includes(perm));

export const STAFF_ROLE_KEYS = ["super_admin", "admin", "operations", "support", "finance"] as const;
export type UserKind = "staff" | "merchant" | "customer";
export function userKindOf(roles: string[] | null | undefined): UserKind {
  const r = roles ?? [];
  if (r.some((x) => (STAFF_ROLE_KEYS as readonly string[]).includes(x))) return "staff";
  if (r.includes("merchant")) return "merchant";
  return "customer";
}

export interface Paged<T> { items: T[]; total: number }

// ---- users ----
export interface AdminProfile {
  id: string; phone: string; name: string | null; createdAt: string; accountStatus: string; userType: string | null;
  businessName: string | null; businessCategoryId: string | null; city: string | null; district: string | null; address: string | null;
  approvedAt: string | null; approvedBy: string | null; suspendedUntil: string | null; statusReason: string | null;
}
export interface AdminUserRow extends AdminProfile { roles: string[]; stores: { id: string; name: string; status: string }[] }
export type ListUsersQuery = { kind?: "all" | "customers" | "merchants" | "staff"; role?: string | null; search?: string | null; status?: string | null; category_slug?: string | null; limit?: number; offset?: number };
export const listUsers = (q: ListUsersQuery) => http.get<Paged<AdminUserRow>>("/admin/users", q);

export interface AdminStore {
  id: string; ownerId: string; name: string; area: string | null; lat: number | null; lng: number | null; isOpen: boolean; rating: string | number | null;
  ratingCount: number | null; deliveryInfo: string | null; phone: string | null; imageUrl: string | null; createdAt: string; status: string;
  commissionPct: string | number | null; businessCategoryId: string | null;
}
export interface AdminUserDetail {
  profile: AdminProfile;
  user: { createdAt: string; lastLoginAt: string | null; forcePasswordChange: boolean; disabledAt: string | null } | undefined;
  roles: string[]; perms: string[]; stores: AdminStore[]; wallet: { id: string; balance: number; created_at: string };
}

// ---- permissions ----
export interface PermDef { perm: string; grp: string; grpLabel: string; label: string; sort: number; superOnly: boolean }
export interface PermBundle { bundle: string; label: string; sort: number; perms: string[] }
export interface PermCatalog { defs: PermDef[]; bundles: PermBundle[] }
export const getPermissionCatalog = () => http.get<PermCatalog>("/admin/permissions/catalog");

// ---- content ----
export interface BusinessCategory { id: string; slug: string; nameAr: string; isActive: boolean; sortOrder: number; createdAt: string }

// ---- catalog (shared product library) ----
export interface CatalogCategory {
  id: string; name: string; icon: string | null; imageUrl: string | null; mainSection: string | null; parentCategory: string | null;
  sortOrder: number; usageCount: number; itemsCount: number;
}
export interface CatalogItem {
  id: string; name: string; defaultPrice: string | number | null; imageUrl: string | null; barcode: string | null; categoryName: string | null;
  usageCount: number; source: string; createdAt: string; categoryId: string | null; categoryPath: string | null; description: string | null;
  mainSection: string | null; subcategory: string | null; sortOrder: number;
}
export type CatalogItemsQuery = { category_id?: string; q?: string; page?: number; limit?: number; sort?: "name" | "newest" | "usage" };
export const listCatalogItems = (q: CatalogItemsQuery) => http.get<{ items: CatalogItem[]; total: number; page: number; limit: number }>("/catalog/items", q);
/** The API caps `limit` at 200; walks every page (used by Excel export/import and the ZIP importer). */
export async function fetchAllCatalogItems(onPage?: (loaded: number, total: number) => void): Promise<CatalogItem[]> {
  const all: CatalogItem[] = [];
  const limit = 200;
  for (let page = 1; ; page++) {
    const r = await listCatalogItems({ page, limit, sort: "name" });
    all.push(...r.items);
    onPage?.(all.length, r.total);
    if (r.items.length < limit || all.length >= r.total) break;
  }
  return all;
}
/** Bulk upsert result of POST /admin/catalog/items/bulk. */
export interface BulkResult { inserted: number; updated: number; errors: { index: number; error: string }[] }
